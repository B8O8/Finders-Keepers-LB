import { ApiProperty } from '@nestjs/swagger';
import { PaymentStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdatePaymentStatusDto {
  @ApiProperty({ enum: PaymentStatus, example: PaymentStatus.PAID })
  @IsEnum(PaymentStatus)
  paymentStatus!: PaymentStatus;
}