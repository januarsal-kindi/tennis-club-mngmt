import { Module } from '@nestjs/common';
import { AuthCookiesService } from './auth-cookies.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { HelloController } from './hello.controller';
import { MeController } from './me.controller';
import { RolesGuard } from './guards/roles.guard';
import { SessionAuthGuard } from './guards/session-auth.guard';

@Module({
  controllers: [AuthController, MeController, HelloController],
  providers: [AuthService, AuthCookiesService, SessionAuthGuard, RolesGuard],
  exports: [AuthService, AuthCookiesService, SessionAuthGuard, RolesGuard],
})
export class AuthModule {}
