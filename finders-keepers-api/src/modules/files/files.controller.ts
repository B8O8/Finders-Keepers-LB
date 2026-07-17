import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
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
import { GetFilesDto } from './dto/get-files.dto';
import { UpdateFileDto } from './dto/update-file.dto';
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
        title: {
          type: 'string',
          example: 'Blue linen shirt - front',
        },
        altText: {
          type: 'string',
          example: 'Front view of the blue linen shirt',
        },
        caption: {
          type: 'string',
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
  findAll(@Query() query: GetFilesDto) {
    return this.filesService.findAll(query);
  }

  @Get(':id')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MANAGER)
  findOne(@Param('id') id: string) {
    return this.filesService.findOne(id);
  }

  /** Where an image is still used - the admin shows this before deleting. */
  @Get(':id/references')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MANAGER)
  references(@Param('id') id: string) {
    return this.filesService.references(id);
  }

  @Patch(':id')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MANAGER)
  updateMetadata(
    @Param('id') id: string,
    @Body() dto: UpdateFileDto,
    @CurrentAdmin() admin: any,
  ) {
    return this.filesService.updateMetadata(id, dto, admin.id);
  }

  @Delete(':id')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  delete(@Param('id') id: string, @CurrentAdmin() admin: any) {
    return this.filesService.delete(id, admin.id);
  }
}