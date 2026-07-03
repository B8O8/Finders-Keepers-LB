import { ApiProperty } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateAdminDto {
  @ApiProperty({ example: 'manager@finderskeeperslb.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Store Manager' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiProperty({ example: 'Manager@123456' })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({ enum: AdminRole, example: AdminRole.MANAGER })
  @IsEnum(AdminRole)
  role!: AdminRole;
}