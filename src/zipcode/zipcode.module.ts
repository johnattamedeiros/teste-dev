import { Module } from '@nestjs/common';
import { HttpModule, HttpService } from '@nestjs/axios';
import { CacheModule } from '@nestjs/cache-manager';
import { ZipcodeController } from './zipcode.controller';
import { ZipcodeService } from './zipcode.service';
import { ConfigurableZipcodeProvider } from './providers/configurable-zipcode.provider';
import { I18nModule } from '../i18n/i18n.module';
import { I18nService } from '../i18n/i18n.service';
import { ZIPCODE_PROVIDERS_TOKEN, CACHE_TTL_MS } from './constants/providers.constants';
import { PROVIDERS_CONFIG } from './providers.config';
import { ZipcodeProvider } from './interfaces/zipcode.interface';

@Module({
  imports: [
    HttpModule,
    I18nModule,
    CacheModule.register({ ttl: CACHE_TTL_MS }),
  ],
  controllers: [ZipcodeController],
  providers: [
    ZipcodeService,
    {
      provide: ZIPCODE_PROVIDERS_TOKEN,
      useFactory: (httpService: HttpService, i18nService: I18nService): ZipcodeProvider[] =>
        PROVIDERS_CONFIG.map(
          (config) => new ConfigurableZipcodeProvider(config, httpService, i18nService),
        ),
      inject: [HttpService, I18nService],
    },
  ],
  exports: [ZipcodeService],
})
export class ZipcodeModule {}
