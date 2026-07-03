import { Injectable } from '@nestjs/common';

import { MailerService } from '@nestjs-modules/mailer';

import * as React from 'react';

import { render } from '@react-email/components';

import { ResetPasswordEmail } from './react-templates/reset-password-email';

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
}