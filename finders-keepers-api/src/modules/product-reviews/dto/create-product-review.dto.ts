import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateProductReviewDto {
  @ApiProperty({ example: 'product-id-here' })
  @IsString()
  productId!: string;

  @ApiProperty({ example: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional({ example: 'Great product' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ example: 'Very good quality and fast delivery.' })
  @IsString()
  comment!: string;
}