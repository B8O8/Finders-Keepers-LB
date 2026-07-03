import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PermissionsController } from './permissions.controller';
import { PermissionsService } from './permissions.service';

@Global()
@Module({
  imports: [JwtModule.register({})],
  controllers: [PermissionsController],
  providers: [PermissionsService],
  exports: [PermissionsService],
})
export class PermissionsModule {}
