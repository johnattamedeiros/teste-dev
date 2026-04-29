import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { HttpModule } from '@nestjs/axios';
import { ZipcodeModule } from './zipcode/zipcode.module';
import { I18nModule } from './i18n/i18n.module';
import { HealthModule } from './health/health.module';
import { CorrelationIdMiddleware } from './common/correlation-id.middleware';
import { LoggingInterceptor } from './common/logging.interceptor';
import { WinstonLoggerService } from './common/winston-logger.service';
import { AppExceptionFilter } from './common/filters/app-exception.filter';

@Module({
  imports: [HttpModule, I18nModule, ZipcodeModule, HealthModule],
  providers: [
    WinstonLoggerService,
    {
      provide: APP_FILTER,
      useClass: AppExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
