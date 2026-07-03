import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UploadFileDto {
  @ApiPropertyOptional({ example: 'Product' })
  @IsOptional()
  @IsString()
  entity?: string;

  @ApiPropertyOptional({ example: 'product-id-here' })
  @IsOptional()
  @IsString()
  entityId?: string;
}