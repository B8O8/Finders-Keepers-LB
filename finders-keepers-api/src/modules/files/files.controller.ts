import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiTags,
} from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { CurrentAdmin } from '../../common/decorators/current-admin.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UploadFileDto } from './dto/upload-file.dto';
import { FilesService } from './files.service';

@ApiTags('Files')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MANAGER)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        entity: {
          type: 'string',
          example: 'Product',
        },
        entityId: {
          type: 'string',
          example: 'product-id-here',
        },
      },
      required: ['file'],
    },
  })
  upload(
    @UploadedFile() file: any,
    @Body() dto: UploadFileDto,
    @CurrentAdmin() admin: any,
  ) {
    return this.filesService.upload(file, dto, admin.id);
  }

  @Get()
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MANAGER)
  findAll() {
    return this.filesService.findAll();
  }

  @Delete(':id')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  delete(@Param('id') id: string, @CurrentAdmin() admin: any) {
    return this.filesService.delete(id, admin.id);
  }
}