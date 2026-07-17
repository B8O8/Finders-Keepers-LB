-- Additive: durable notification outbox for wishlist sale alerts.
--
-- Rows are enqueued transactionally with the discount, then delivered by a
-- background processor, so a mail failure can never roll back a discount.
--
-- dedupeKey is a single non-null unique column (not a composite over nullable
-- columns) so re-running the enqueue job is idempotent and can never produce a
-- duplicate email for the same customer/discount/item/channel.

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'IN_APP');
CREATE TYPE "NotificationType" AS ENUM ('WISHLIST_SALE');
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'EMAIL',
    "type" "NotificationType" NOT NULL DEFAULT 'WISHLIST_SALE',
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "discountId" TEXT,
    "productId" TEXT,
    "variantId" TEXT,
    "payload" JSONB,
    "dedupeKey" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "claimedBy" TEXT,
    "nextAttemptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");
CREATE INDEX "Notification_status_idx" ON "Notification"("status");
CREATE INDEX "Notification_customerId_idx" ON "Notification"("customerId");
CREATE INDEX "Notification_discountId_idx" ON "Notification"("discountId");
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");
-- Pending-job lookup: status + due time + attempt count.
CREATE INDEX "Notification_status_nextAttemptAt_attempts_idx" ON "Notification"("status", "nextAttemptAt", "attempts");
-- Reclaiming jobs abandoned by a dead worker.
CREATE INDEX "Notification_status_claimedAt_idx" ON "Notification"("status", "claimedAt");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Deleting a discount keeps its notification history (audit trail).
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_discountId_fkey"
  FOREIGN KEY ("discountId") REFERENCES "Discount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
