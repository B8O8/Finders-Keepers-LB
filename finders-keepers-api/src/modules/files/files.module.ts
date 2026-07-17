import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { LocalStorageService } from './local-storage.service';
import { MinioStorageService } from './minio-storage.service';

@Module({
  imports: [JwtModule.register({}), ActivityLogsModule],
  controllers: [FilesController],
  // LocalStorageService stays registered so existing StorageType.LOCAL rows can
  // still be read and deleted; MinioStorageService handles everything new.
  providers: [FilesService, LocalStorageService, MinioStorageService],
  exports: [FilesService, LocalStorageService, MinioStorageService],
})
export class FilesModule {}
