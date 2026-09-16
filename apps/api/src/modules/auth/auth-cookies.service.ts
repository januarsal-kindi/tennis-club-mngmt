import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';
import { SESSION_COOKIE, SESSION_TTL_MS } from './auth.constants';

@Injectable()
export class AuthCookiesService {
  constructor(private readonly config: ConfigService) {}

  setSession(response: Response, token: string): void {
    response.cookie(SESSION_COOKIE, token, this.options());
  }

  clearSession(response: Response): void {
    response.clearCookie(SESSION_COOKIE, this.options());
  }

  readToken(request: Request): string | undefined {
    const header = request.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      const bearer = header.slice('Bearer '.length).trim();
      if (bearer.length > 0) {
        return bearer;
      }
    }

    return readCookie(request.headers.cookie, SESSION_COOKIE);
  }

  private options(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get<string>('NODE_ENV') === 'production',
      path: '/',
      maxAge: SESSION_TTL_MS,
    };
  }
}

function readCookie(
  cookieHeader: string | undefined,
  name: string,
): string | undefined {
  if (!cookieHeader) {
    return undefined;
  }

  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) {
      continue;
    }
    if (part.slice(0, separator).trim() !== name) {
      continue;
    }

    return decodeURIComponent(part.slice(separator + 1).trim());
  }

  return undefined;
}
