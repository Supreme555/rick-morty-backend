import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const { method, originalUrl } = ctx.getRequest<Request>();
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const { statusCode } = ctx.getResponse<Response>();
          this.logger.log(
            `${method} ${originalUrl} ${statusCode} — ${Date.now() - start}ms`,
          );
        },
        error: (error: unknown) => {
          const status =
            error instanceof HttpException ? error.getStatus() : 500;
          this.logger.log(
            `${method} ${originalUrl} ${status} — ${Date.now() - start}ms`,
          );
        },
      }),
    );
  }
}
