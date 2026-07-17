import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, ValidateNested } from 'class-validator';

import { AddWishlistItemDto } from './add-wishlist-item.dto';

/**
 * Used once, right after login, to lift a guest's localStorage wishlist into
 * their account. Capped to keep a hostile payload from spamming the table.
 */
export class MergeWishlistDto {
  @ApiProperty({ type: [AddWishlistItemDto] })
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => AddWishlistItemDto)
  items!: AddWishlistItemDto[];
}
