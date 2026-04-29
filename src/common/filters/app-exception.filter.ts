import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ZipcodeNotFoundException } from '../../zipcode/exceptions/zipcode-not-found.exception';
import { AllProvidersUnavailableException } from '../../zipcode/exceptions/all-providers-unavailable.exception';
import { RequestContext } from '../request-context';
import { I18nService } from '../../i18n/i18n.service';

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppExceptionFilter.name);

  constructor(private readonly i18nService: I18nService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestCtx = RequestContext.get();
    const requestId = requestCtx?.requestId;

    if (exception instanceof ZipcodeNotFoundException) {
      this.logger.warn({
        event: 'zipcode_not_found',
        zipcode: exception.zipcode,
        path: request.url,
        requestId,
      });
      this.logRequestCompleted(404, request.method, request.url, requestCtx);
      response.status(404).json({
        statusCode: 404,
        error: 'Not Found',
        message: exception.message,
        requestId,
      });
      return;
    }

    if (exception instanceof AllProvidersUnavailableException) {
      this.logger.error({
        event: 'all_providers_unavailable',
        failures: exception.failures,
        path: request.url,
        requestId,
      });
      this.logRequestCompleted(502, request.method, request.url, requestCtx);
      response.status(502).json({
        statusCode: 502,
        error: 'Bad Gateway',
        message: exception.message,
        details: exception.failures,
        requestId,
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const payload =
        typeof body === 'object'
          ? { ...(body as object), requestId }
          : { message: body, requestId };

      this.logRequestCompleted(status, request.method, request.url, requestCtx);
      response.status(status).json(payload);
      return;
    }

    const message = exception instanceof Error ? exception.message : 'Erro desconhecido';
    this.logger.error({
      event: 'unhandled_exception',
      error: message,
      stack: exception instanceof Error ? exception.stack : undefined,
      path: request.url,
      requestId,
    });
    this.logRequestCompleted(500, request.method, request.url, requestCtx);
    response.status(500).json({
      statusCode: 500,
      error: 'Internal Server Error',
      message: this.i18nService.t('errors.internal'),
      requestId,
    });
  }

  private logRequestCompleted(
    statusCode: number,
    method: string,
    url: string,
    ctx: ReturnType<typeof RequestContext.get>,
  ): void {
    const duration_ms = ctx?.startTime ? Date.now() - ctx.startTime : undefined;
    this.logger.log({
      event: 'request_completed',
      method,
      url,
      statusCode,
      duration_ms,
      requestId: ctx?.requestId,
    });
  }
}
