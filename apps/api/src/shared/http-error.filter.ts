import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';

type ErrorBody = { code: string; message: string; details?: string[] };

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const body = toErrorBody(exception);
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    response.status(status).json(body);
  }
}

function toErrorBody(exception: unknown): ErrorBody {
  if (!(exception instanceof HttpException)) {
    return { code: 'ERROR', message: 'Internal server error' };
  }

  const status = exception.getStatus();
  const payload = exception.getResponse();
  const messages = extractMessages(payload);
  const codeFromPayload =
    typeof payload === 'object' && payload !== null && 'code' in payload
      ? String((payload as { code: unknown }).code)
      : undefined;

  return {
    code: codeFromPayload ?? codeForStatus(status),
    message: messages[0] ?? exception.message,
    ...(messages.length > 1 ? { details: messages } : {}),
  };
}

function extractMessages(payload: string | object): string[] {
  if (typeof payload === 'string') {
    return [payload];
  }

  if (typeof payload === 'object' && payload !== null && 'message' in payload) {
    const message = (payload as { message: unknown }).message;
    if (typeof message === 'string') {
      return [message];
    }
    if (Array.isArray(message)) {
      return message.filter((item): item is string => typeof item === 'string');
    }
  }

  return [];
}

function codeForStatus(status: number): string {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return 'VALIDATION';
    case HttpStatus.UNAUTHORIZED:
      return 'UNAUTHORIZED';
    case HttpStatus.FORBIDDEN:
      return 'FORBIDDEN';
    case HttpStatus.NOT_FOUND:
      return 'NOT_FOUND';
    case HttpStatus.CONFLICT:
      return 'CONFLICT';
    default:
      return 'ERROR';
  }
}
