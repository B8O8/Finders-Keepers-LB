import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBooleanString,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

const emptyToUndefined = ({ value }: { value: unknown }) =>
  value === '' ? undefined : value;

export type DiscountStatusFilter = 'active' | 'scheduled' | 'expired' | 'inactive';

export class GetDiscountsDto {
  @ApiPropertyOptional({ description: 'Matches name, description or public label' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['active', 'scheduled', 'expired', 'inactive'] })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsIn(['active', 'scheduled', 'expired', 'inactive'])
  status?: DiscountStatusFilter;

  @ApiPropertyOptional({ description: 'Discounts running on/after this date' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsDateString()
  startsFrom?: string;

  @ApiPropertyOptional({ description: 'Discounts running on/before this date' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsDateString()
  startsTo?: string;

  @ApiPropertyOptional({ description: 'Include archived (soft-deleted) discounts' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsBooleanString()
  includeArchived?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
