import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

import { PrismaService } from '../../database/prisma.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService, WishlistSalePayload } from './notifications.service';
import {
  canRetry,
  CLAIM_TIMEOUT_MS,
  MAX_NOTIFICATION_ATTEMPTS,
  nextAttemptAt,
} from './notification.util';

/**
 * Drains the notification outbox.
 *
 * Runs on a schedule rather than inside the HTTP request that creates a
 * discount, so a large sale cannot make the admin's request hang or time out,
 * and an SMTP outage cannot roll back the discount itself.
 *
 * MULTI-REPLICA SAFE. Each tick atomically claims a batch with
 * `UPDATE ... WHERE id IN (SELECT ... FOR UPDATE SKIP LOCKED)`. Postgres hands
 * each row to exactly one transaction, and SKIP LOCKED means a second worker
 * steps over rows already claimed rather than blocking. Two workers therefore
 * cannot send the same email even with many API replicas.
 *
 * Delivery happens AFTER the claim transaction commits: SMTP is slow and must
 * never hold row locks open.
 *
 * A worker that dies mid-batch leaves rows claimed; those are reclaimed once
 * the claim is older than CLAIM_TIMEOUT_MS, so nothing is stranded.
 */
@Injectable()
export class NotificationsProcessor {
  private readonly logger = new Logger(NotificationsProcessor.name);

  /** Identifies this replica in the claim, for debugging. */
  private readonly workerId = `${process.env.HOSTNAME || 'api'}-${randomUUID().slice(0, 8)}`;

  /** Small batches keep SMTP well within rate limits. */
  private static readonly BATCH_SIZE = 25;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCron() {
    await this.enqueueNewlyLiveDiscounts();
    await this.processPending();
  }

  /**
   * Finds discounts that are now live but whose wishlist notifications have not
   * been queued yet, and queues them.
   *
   * Polling a durable marker (instead of calling this from DiscountsService)
   * keeps the discounts module free of any dependency on notifications, and
   * means a discount that goes live on a schedule - or one that was created
   * while the mailer was down - is still picked up after a restart.
   */
  async enqueueNewlyLiveDiscounts(): Promise<{ discounts: number; queued: number }> {
    const now = new Date();

    const due = await this.prisma.discount.findMany({
      where: {
        archivedAt: null,
        isActive: true,
        notificationsEnqueuedAt: null,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      },
      select: { id: true, name: true },
      take: 10,
    });

    let queued = 0;

    for (const discount of due) {
      try {
        const result = await this.notifications.enqueueForDiscount(discount.id);
        queued += result.queued;

        // Marked only after a successful enqueue, so a failure here is retried
        // on the next tick rather than silently skipping the discount.
        await this.prisma.discount.update({
          where: { id: discount.id },
          data: { notificationsEnqueuedAt: new Date() },
        });

        if (result.queued) {
          this.logger.log(
            `Discount "${discount.name}": queued ${result.queued} wishlist notification(s)`,
          );
        }
      } catch (error: any) {
        this.logger.error(
          `Failed to queue notifications for discount ${discount.id}: ${error?.message ?? error}`,
        );
      }
    }

    return { discounts: due.length, queued };
  }

  /**
   * Atomically claims a batch of due notifications for THIS worker.
   *
   * The SELECT ... FOR UPDATE SKIP LOCKED inside the UPDATE is what makes this
   * safe across replicas: concurrent workers skip rows another transaction has
   * locked instead of waiting for them, so each row is claimed exactly once.
   */
  private async claimBatch(limit: number): Promise<string[]> {
    const now = new Date();
    const abandonedBefore = new Date(now.getTime() - CLAIM_TIMEOUT_MS);

    const rows = await this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      UPDATE "Notification" AS n
      SET "claimedAt" = ${now}, "claimedBy" = ${this.workerId}
      WHERE n."id" IN (
        SELECT c."id" FROM "Notification" c
        WHERE c."status" = 'PENDING'
          AND c."attempts" < ${MAX_NOTIFICATION_ATTEMPTS}
          AND (c."nextAttemptAt" IS NULL OR c."nextAttemptAt" <= ${now})
          AND (c."claimedAt" IS NULL OR c."claimedAt" < ${abandonedBefore})
        ORDER BY c."createdAt" ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING n."id"
    `);

    return rows.map((r) => r.id);
  }

  async processPending(): Promise<{ sent: number; failed: number }> {
    // Claim first; the lock is released as soon as this statement commits, so
    // slow SMTP never holds database rows.
    const claimedIds = await this.claimBatch(NotificationsProcessor.BATCH_SIZE);

    if (!claimedIds.length) {
      return { sent: 0, failed: 0 };
    }

    const batch = await this.prisma.notification.findMany({
      where: { id: { in: claimedIds } },
      include: { customer: { select: { email: true, firstName: true } } },
    });

    let sent = 0;
    let failed = 0;

    for (const notification of batch) {
      const email = notification.customer?.email;
      const payload = notification.payload as unknown as WishlistSalePayload | null;

      if (!email || !payload) {
        // Nothing to send to - terminal, do not burn retries forever.
        await this.prisma.notification.update({
          where: { id: notification.id },
          data: {
            status: NotificationStatus.FAILED,
            attempts: { increment: 1 },
            error: !email ? 'Customer has no email address' : 'Missing payload',
            claimedAt: null,
            claimedBy: null,
          },
        });
        failed++;
        continue;
      }

      try {
        await this.mail.sendWishlistSaleEmail(
          email,
          payload,
          notification.customer?.firstName ?? undefined,
        );

        await this.prisma.notification.update({
          where: { id: notification.id },
          data: {
            status: NotificationStatus.SENT,
            sentAt: new Date(),
            attempts: { increment: 1 },
            error: null,
            claimedAt: null,
            claimedBy: null,
          },
        });
        sent++;
      } catch (error: any) {
        const attempts = notification.attempts + 1;
        const message = String(error?.message ?? error).slice(0, 500);
        const retryable = canRetry(attempts);

        await this.prisma.notification.update({
          where: { id: notification.id },
          data: {
            status: retryable ? NotificationStatus.PENDING : NotificationStatus.FAILED,
            attempts,
            error: message,
            // Bounded exponential backoff before the next attempt.
            nextAttemptAt: retryable ? nextAttemptAt(attempts) : null,
            claimedAt: null,
            claimedBy: null,
          },
        });

        failed++;
        this.logger.warn(
          `Notification ${notification.id} failed (attempt ${attempts}/${MAX_NOTIFICATION_ATTEMPTS}): ${message}`,
        );
      }
    }

    if (sent || failed) {
      this.logger.log(`[${this.workerId}] batch: ${sent} sent, ${failed} failed`);
    }

    return { sent, failed };
  }

}
