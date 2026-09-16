import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthCookiesService } from '../auth-cookies.service';
import { AuthService, type PublicUser } from '../auth.service';
import { IS_PUBLIC_KEY } from './public.decorator';

export type AuthenticatedRequest = Request & {
  user: PublicUser;
  sessionId: string;
};

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly cookies: AuthCookiesService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const session = await this.auth.authenticate(this.cookies.readToken(request));
    const authenticated = request as AuthenticatedRequest;
    authenticated.user = session.user;
    authenticated.sessionId = session.sessionId;

    return true;
  }
}
