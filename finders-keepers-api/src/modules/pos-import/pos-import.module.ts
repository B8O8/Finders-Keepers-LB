import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MulterModule } from '@nestjs/platform-express';
import { PosImportController } from './pos-import.controller';
import { PosImportService } from './pos-import.service';

@Module({
  imports: [
    JwtModule.register({}),
    MulterModule.register({ limits: { fileSize: 10 * 1024 * 1024 } }), // 10MB
  ],
  controllers: [PosImportController],
  providers: [PosImportService],
})
export class PosImportModule {}
