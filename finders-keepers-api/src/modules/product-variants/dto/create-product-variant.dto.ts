import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateProductVariantDto {
  @ApiProperty({ example: 'product-id-here' })
  @IsString()
  productId!: string;

  @ApiPropertyOptional({ example: 'Size S' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'FK-TSHIRT-S' })
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiPropertyOptional({ example: '12345' })
  @IsOptional()
  @IsString()
  plu?: string;

  @ApiPropertyOptional({ example: '5280000000000' })
  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiProperty({ example: 4 })
  @IsNumber()
  @Min(0)
  price!: number;

  @ApiPropertyOptional({ example: 2.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  costPrice?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  stock?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}