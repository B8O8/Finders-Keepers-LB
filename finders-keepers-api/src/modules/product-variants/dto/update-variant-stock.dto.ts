import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min } from 'class-validator';

export class UpdateVariantStockDto {
  @ApiProperty({ example: 25 })
  @IsNumber()
  @Min(0)
  stock!: number;
}