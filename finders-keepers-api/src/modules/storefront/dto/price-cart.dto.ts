import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class PriceCartLineDto {
  @ApiProperty()
  @IsString()
  variantId!: string;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
}

/**
 * Prices a client-held cart.
 *
 * The storefront keeps the cart in local storage for instant interaction, but
 * must never compute money itself. This returns authoritative prices from the
 * same engine used at checkout, so the preview cannot disagree with the order.
 */
export class PriceCartDto {
  @ApiProperty({ type: [PriceCartLineDto] })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => PriceCartLineDto)
  items!: PriceCartLineDto[];
}
