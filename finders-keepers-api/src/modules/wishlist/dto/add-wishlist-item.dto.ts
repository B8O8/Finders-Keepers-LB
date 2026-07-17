import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

const emptyToUndefined = ({ value }: { value: unknown }) =>
  value === '' ? undefined : value;

export class AddWishlistItemDto {
  @ApiProperty()
  @IsString()
  productId!: string;

  @ApiPropertyOptional({
    description: 'Omit to wishlist the product as a whole (any variant)',
  })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  variantId?: string;
}
