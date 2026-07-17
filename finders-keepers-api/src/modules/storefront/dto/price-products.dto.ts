import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayUnique, IsArray, IsString } from 'class-validator';

/**
 * Prices a set of products the client already knows about (wishlist,
 * recently-viewed). Those lists live in local storage and cache a price at the
 * time they were saved, which goes stale the moment a discount changes - so the
 * real price has to come back from the server.
 */
export class PriceProductsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsString({ each: true })
  productIds!: string[];
}
