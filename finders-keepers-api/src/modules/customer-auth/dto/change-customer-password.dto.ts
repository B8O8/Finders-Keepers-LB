import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ChangeCustomerPasswordDto {
  @ApiProperty({ example: 'OldPassword@123' })
  @IsString()
  @MinLength(6)
  currentPassword!: string;

  @ApiProperty({ example: 'NewPassword@123' })
  @IsString()
  @MinLength(6)
  newPassword!: string;
}