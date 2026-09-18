import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';
import { SESSION_COOKIE, SESSION_TTL_MS } from './auth.constants';

@Injectable()
export class AuthCookiesService {
  constructor(private readonly config: ConfigService) {}

  setSession(response: Response, token: string): void {
    response.cookie(SESSION_COOKIE, token, {
      ...this.cookieFlags(),
      maxAge: SESSION_TTL_MS,
    });
  }

  clearSession(response: Response): void {
    // Omit maxAge — passing SESSION_TTL_MS into clearCookie lets Express
    // overwrite the epoch Expires and re-issue a live cookie.
    response.clearCookie(SESSION_COOKIE, this.cookieFlags());
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

  private cookieFlags(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get<string>('NODE_ENV') === 'production',
      path: '/',
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
