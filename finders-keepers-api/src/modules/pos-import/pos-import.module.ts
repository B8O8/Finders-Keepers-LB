import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MulterModule } from '@nestjs/platform-express';
import { PosImportController } from './pos-import.controller';
import { PosImportService } from './pos-import.service';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';

@Module({
  imports: [
    JwtModule.register({}),
    MulterModule.register({ limits: { fileSize: 10 * 1024 * 1024 } }), // 10MB
    ActivityLogsModule,
  ],
  controllers: [PosImportController],
  providers: [PosImportService],
})
export class PosImportModule {}
