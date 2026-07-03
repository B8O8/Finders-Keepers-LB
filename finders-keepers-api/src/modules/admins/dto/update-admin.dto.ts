import { ApiPropertyOptional } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateAdminDto {
  @ApiPropertyOptional({ example: 'Store Manager' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ enum: AdminRole, example: AdminRole.ADMIN })
  @IsOptional()
  @IsEnum(AdminRole)
  role?: AdminRole;

  @ApiPropertyOptional({ example: 'NewPassword@123' })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}
