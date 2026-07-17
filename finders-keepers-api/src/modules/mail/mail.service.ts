import { Injectable } from '@nestjs/common';

import { MailerService } from '@nestjs-modules/mailer';

import * as React from 'react';

import { render } from '@react-email/components';

import { ResetPasswordEmail } from './react-templates/reset-password-email';
import {
  WishlistSaleEmail,
  WishlistSaleEmailProps,
} from './react-templates/wishlist-sale-email';

@Injectable()
export class MailService {
  constructor(
    private readonly mailerService: MailerService,
  ) {}

  async sendResetPasswordEmail(
    email: string,
    resetUrl: string,
    customerName?: string,
  ) {
    const html = await render(
      React.createElement(
        ResetPasswordEmail,
        {
          resetUrl,
          customerName,
        },
      ),
    );

    await this.mailerService.sendMail({
      to: email,

      subject:
        'Reset Your Password - Finders Keepers LB',

      html,
    });
  }

  /**
   * "Your wishlisted item is on sale".
   *
   * Throws on failure so the notification processor can record the error and
   * retry; it must never swallow a delivery problem silently.
   */
  async sendWishlistSaleEmail(
    email: string,
    payload: Omit<WishlistSaleEmailProps, 'customerName'>,
    customerName?: string,
  ) {
    const html = await render(
      React.createElement(WishlistSaleEmail, {
        ...payload,
        customerName,
      }),
    );

    await this.mailerService.sendMail({
      to: email,

      subject: `${payload.productName} is on sale - Finders Keepers LB`,

      html,
    });
  }
}