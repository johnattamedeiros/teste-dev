import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { RequestContext } from './request-context';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const { method, url } = req;
    const ctx = RequestContext.get();
    const start = Date.now();

    this.logger.log({
      event: 'request_received',
      method,
      url,
      requestId: ctx?.requestId,
    });

    return next.handle().pipe(
      tap({
        next: () => {
          const res = context.switchToHttp().getResponse();
          this.logger.log({
            event: 'request_completed',
            method,
            url,
            statusCode: res.statusCode,
            duration_ms: Date.now() - start,
            requestId: ctx?.requestId,
          });
        },
      }),
    );
  }
}
