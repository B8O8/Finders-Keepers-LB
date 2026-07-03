import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';

@Module({
  imports: [JwtModule.register({}), ActivityLogsModule],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}