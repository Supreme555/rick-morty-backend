import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { Request } from 'express';

/**
 * Nest's BaseExceptionFilter already maps HttpException and http-errors
 * (body-parser 413/415, "request aborted"…) and guards against headers that
 * were already sent — we only add structured logging on top of it.
 */
@Catch()
export class AllExceptionsFilter extends BaseExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  override catch(exception: unknown, host: ArgumentsHost): void {
    const req = host.switchToHttp().getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : this.isHttpError(exception)
          ? exception.statusCode
          : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof Error ? exception.message : 'Internal server error';
    const label = `${req.method} ${req.originalUrl} ${status} — ${message}`;

    if (status >= 500) {
      this.logger.error(
        label,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(label);
    }

    super.catch(exception, host);
  }
}
