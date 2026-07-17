import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DiscountType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

/** Empty strings from admin forms are treated as "not provided". */
const emptyToUndefined = ({ value }: { value: unknown }) =>
  value === '' ? undefined : value;

export class CreateDiscountDto {
  @ApiProperty({ example: 'Summer Sale' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({ description: 'Internal note, never shown to customers' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '-20%', description: 'Public promotional label' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  publicLabel?: string;

  @ApiProperty({ enum: DiscountType, example: DiscountType.PERCENTAGE })
  @IsEnum(DiscountType)
  type!: DiscountType;

  /**
   * Percentage discounts are additionally bounded to <= 100 in the service,
   * where the type is known.
   */
  @ApiProperty({ example: 20 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  value!: number;

  @ApiProperty({ example: '2026-07-15T00:00:00.000Z' })
  @IsDateString()
  startsAt!: string;

  @ApiPropertyOptional({ example: '2026-08-15T00:00:00.000Z', description: 'Null = open-ended' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsDateString()
  endsAt?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 50, description: 'Only applies once cart subtotal reaches this' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minOrderAmount?: number;

  @ApiPropertyOptional({ example: 25, description: 'Caps how much this discount can take off' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  maxDiscountAmount?: number;

  @ApiPropertyOptional({ example: 0, description: 'Higher wins when discounts overlap' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  priority?: number;

  @ApiPropertyOptional({ example: false, description: 'May combine with other stackable discounts' })
  @IsOptional()
  @IsBoolean()
  stackable?: boolean;

  @ApiPropertyOptional({ type: [String], description: 'Target whole products' })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  productIds?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Target specific variants' })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  variantIds?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Target whole categories' })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  categoryIds?: string[];
}
