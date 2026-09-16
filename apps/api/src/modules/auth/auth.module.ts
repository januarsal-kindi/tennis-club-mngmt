import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthCookiesService } from './auth-cookies.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { HelloController } from './hello.controller';
import { MeController } from './me.controller';
import { RolesGuard } from './guards/roles.guard';
import { SessionAuthGuard } from './guards/session-auth.guard';

@Module({
  controllers: [AuthController, MeController, HelloController],
  providers: [
    AuthService,
    AuthCookiesService,
    RolesGuard,
    { provide: APP_GUARD, useClass: SessionAuthGuard },
  ],
  exports: [AuthService, AuthCookiesService, RolesGuard],
})
export class AuthModule {}
