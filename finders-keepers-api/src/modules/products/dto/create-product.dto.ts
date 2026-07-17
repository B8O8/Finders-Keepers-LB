import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Empty strings from admin forms are treated as "not provided". */
const emptyToUndefined = ({ value }: { value: unknown }) =>
  value === '' ? undefined : value;

/**
 * Variant payload nested inside a product create/update request.
 *
 * Deliberately mirrors every field exposed by the variant edit screen, so a
 * product can be fully configured in one pass instead of being created and then
 * immediately edited. Shared with UpdateProductDto via PartialType.
 *
 * NOT named CreateProductVariantDto: that name belongs to the standalone
 * POST /product-variants body, which carries a required productId this one must
 * not have. Two classes with one name make Swagger emit a single merged schema
 * for both endpoints and warn "Duplicate DTO detected".
 */
export class ProductVariantInputDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  sku?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  plu?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  barcode?: string;

  @ApiPropertyOptional({ description: 'External POS identifier' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  posProductId?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number;

  @ApiPropertyOptional({ description: 'Struck-through "was" price' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  compareAtPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  costPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  weight?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock?: number;

  @ApiPropertyOptional({ description: 'Allow ordering when stock is 0' })
  @IsOptional()
  @IsBoolean()
  allowBackorder?: boolean;

  @ApiPropertyOptional({ example: 'Available on order - ships in 2 weeks' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  backorderMessage?: string;

  @ApiPropertyOptional({ description: 'Estimated restock/availability date' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsDateString()
  availabilityDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    type: [String],
    description: 'FileAsset ids to associate with this specific variant',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  imageIds?: string[];
}

export class CreateProductDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  slug!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  shortDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  description?: string;

  /**
   * DEPRECATED single-category field.
   *
   * Still accepted so existing API clients keep working: when supplied without
   * categoryIds it is treated as a one-element categoryIds list.
   */
  @ApiPropertyOptional({ deprecated: true, description: 'Use categoryIds instead' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ type: [String], description: 'A product may belong to many categories' })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  categoryIds?: string[];

  @ApiPropertyOptional({
    description: 'Must be one of categoryIds. Used for breadcrumbs and SEO.',
  })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  primaryCategoryId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  imageIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  seoTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  seoDescription?: string;

  @ApiProperty({ type: [ProductVariantInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantInputDto)
  variants!: ProductVariantInputDto[];
}
