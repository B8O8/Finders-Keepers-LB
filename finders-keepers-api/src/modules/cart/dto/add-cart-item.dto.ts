import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class AddCartItemDto {
  @ApiProperty()
  @IsString()
  variantId!: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiProperty({
    required: false,
    example: 'guest-session-token',
  })
  @IsOptional()
  @IsString()
  guestToken?: string;
}