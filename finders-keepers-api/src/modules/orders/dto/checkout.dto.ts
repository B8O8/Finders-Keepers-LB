import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CheckoutDto {
  @ApiPropertyOptional({ example: 'guest-session-token' })
  @IsOptional()
  @IsString()
  guestToken?: string;

  @ApiPropertyOptional({ example: 'customer-address-id' })
  @IsOptional()
  @IsString()
  addressId?: string;

  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @IsString()
  guestName?: string;

  @ApiPropertyOptional({ example: 'guest@example.com' })
  @IsOptional()
  @IsEmail()
  guestEmail?: string;

  @ApiPropertyOptional({ example: '+96170123456' })
  @IsOptional()
  @IsString()
  guestPhone?: string;

  @ApiPropertyOptional({ example: 'Beirut' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'Achrafieh' })
  @IsOptional()
  @IsString()
  area?: string;

  @ApiPropertyOptional({ example: 'Main Street' })
  @IsOptional()
  @IsString()
  street?: string;

  @ApiPropertyOptional({ example: 'Building A' })
  @IsOptional()
  @IsString()
  building?: string;

  @ApiPropertyOptional({ example: '3' })
  @IsOptional()
  @IsString()
  floor?: string;

  @ApiPropertyOptional({ example: '12' })
  @IsOptional()
  @IsString()
  apartment?: string;

  @ApiPropertyOptional({ example: 33.8938 })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ example: 35.5018 })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({
    enum: PaymentMethod,
    example: PaymentMethod.CASH_ON_DELIVERY,
  })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ example: 'Please call before delivery' })
  @IsOptional()
  @IsString()
  notes?: string;
}