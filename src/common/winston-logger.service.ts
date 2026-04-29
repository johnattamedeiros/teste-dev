import { Injectable, LoggerService } from '@nestjs/common';
import * as winston from 'winston';
import { RequestContext } from './request-context';

@Injectable()
export class WinstonLoggerService implements LoggerService {
  private readonly winston: winston.Logger;

  constructor() {
    const isDev = process.env.NODE_ENV !== 'production';

    this.winston = winston.createLogger({
      level: isDev ? 'debug' : 'info',
      format: isDev
        ? winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ level, message, context, requestId, ...meta }) => {
              const ctx = context ? `[${context}]` : '';
              const reqId = requestId ? ` (${requestId})` : '';
              const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
              return `${level} ${ctx}${reqId} ${message}${extra}`;
            }),
          )
        : winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
      transports: [new winston.transports.Console()],
    });
  }

  private meta(optionalParams: any[]): { context?: string; extra: Record<string, unknown> } {
    const last = optionalParams[optionalParams.length - 1];
    const context = typeof last === 'string' ? last : undefined;
    const requestId = RequestContext.get()?.requestId;
    return { context, extra: requestId ? { requestId } : {} };
  }

  private buildPayload(message: any, context: string | undefined, extra: Record<string, unknown>): Record<string, unknown> {
    if (typeof message === 'object' && message !== null) {
      const logMessage: string = message.message ?? message.event ?? 'log';
      return { message: logMessage, ...extra, ...(context && { context }), ...message };
    }
    return { message, ...extra, ...(context && { context }) };
  }

  log(message: any, ...optionalParams: any[]): void {
    const { context, extra } = this.meta(optionalParams);
    this.winston.info(this.buildPayload(message, context, extra));
  }

  error(message: any, ...optionalParams: any[]): void {
    const context = typeof optionalParams[optionalParams.length - 1] === 'string'
      ? optionalParams[optionalParams.length - 1]
      : undefined;
    const trace = optionalParams.length > 1 && typeof optionalParams[0] === 'string'
      ? optionalParams[0]
      : undefined;
    const requestId = RequestContext.get()?.requestId;
    const extra: Record<string, unknown> = { ...(requestId && { requestId }), ...(trace && { trace }) };
    this.winston.error(this.buildPayload(message, context, extra));
  }

  warn(message: any, ...optionalParams: any[]): void {
    const { context, extra } = this.meta(optionalParams);
    this.winston.warn(this.buildPayload(message, context, extra));
  }

  debug(message: any, ...optionalParams: any[]): void {
    const { context, extra } = this.meta(optionalParams);
    this.winston.debug(this.buildPayload(message, context, extra));
  }

  verbose(message: any, ...optionalParams: any[]): void {
    const { context, extra } = this.meta(optionalParams);
    this.winston.verbose(this.buildPayload(message, context, extra));
  }
}
