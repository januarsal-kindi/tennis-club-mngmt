import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AuthCookiesService } from '../auth-cookies.service';
import { AuthService, type PublicUser } from '../auth.service';

export type AuthenticatedRequest = Request & {
  user: PublicUser;
  sessionId: string;
};

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly cookies: AuthCookiesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const session = await this.auth.authenticate(this.cookies.readToken(request));
    const authenticated = request as AuthenticatedRequest;
    authenticated.user = session.user;
    authenticated.sessionId = session.sessionId;

    return true;
  }
}
