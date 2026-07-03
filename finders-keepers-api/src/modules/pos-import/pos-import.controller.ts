import {
  Controller, Post, UploadedFile, UseGuards, UseInterceptors, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentAdmin } from '../../common/decorators/current-admin.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PosImportService } from './pos-import.service';

@ApiTags('POS Import')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('pos-import')
export class PosImportController {
  constructor(private readonly posImportService: PosImportService) {}

  @Post('preview')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async preview(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!file.originalname.match(/\.xlsx?$/i))
      throw new BadRequestException('File must be an Excel (.xlsx) file');
    return this.posImportService.preview(file.buffer);
  }

  @Post('import')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async import(
    @UploadedFile() file: Express.Multer.File,
    @CurrentAdmin() admin: any,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!file.originalname.match(/\.xlsx?$/i))
      throw new BadRequestException('File must be an Excel (.xlsx) file');
    return this.posImportService.import(file.buffer, admin?.id);
  }
}
