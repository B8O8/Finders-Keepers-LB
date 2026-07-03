import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ModerateProductReviewDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  isApproved!: boolean;
}