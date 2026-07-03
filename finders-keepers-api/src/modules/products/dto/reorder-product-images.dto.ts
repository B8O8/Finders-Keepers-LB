import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class ReorderProductImageItemDto {
  @ApiProperty()
  @IsString()
  imageId!: string;

  @ApiProperty({ example: 0 })
  @IsInt()
  @Min(0)
  sortOrder!: number;
}

export class ReorderProductImagesDto {
  @ApiProperty({ type: [ReorderProductImageItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderProductImageItemDto)
  images!: ReorderProductImageItemDto[];
}