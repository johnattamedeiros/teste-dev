import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ZipcodeResponse, ZipcodeProvider } from './interfaces/zipcode.interface';
import { ZIPCODE_PROVIDERS_TOKEN } from './constants/providers.constants';
import { I18nService } from '../i18n/i18n.service';
import { ZipcodeNotFoundException } from './exceptions/zipcode-not-found.exception';
import { ProviderTimeoutException } from './exceptions/provider-timeout.exception';
import {
  AllProvidersUnavailableException,
  ProviderFailure,
} from './exceptions/all-providers-unavailable.exception';

@Injectable()
export class ZipcodeService {
  private readonly logger = new Logger(ZipcodeService.name);
  private currentProviderIndex = 0;

  constructor(
    @Inject(ZIPCODE_PROVIDERS_TOKEN) private readonly providers: ZipcodeProvider[],
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly i18nService: I18nService,
  ) {}

  async searchZipcode(zipcode: string): Promise<ZipcodeResponse> {
    const cacheKey = zipcode.replace(/\D/g, '');

    const cached = await this.cache.get<ZipcodeResponse>(cacheKey);
    if (cached) {
      this.logger.log({ event: 'cache_hit', zipcode: cacheKey });
      return cached;
    }

    const providers = this.getProvidersRoundRobin();
    const failures: ProviderFailure[] = [];
    let notFoundByAnyProvider = false;

    for (const provider of providers) {
      const startTime = Date.now();
      try {
        this.logger.debug({ event: 'provider_attempt', provider: provider.name, zipcode });
        const result = await provider.getZipcode(zipcode);
        const duration_ms = Date.now() - startTime;
        this.logger.log({ event: 'provider_success', provider: provider.name, zipcode, duration_ms });
        await this.cache.set(cacheKey, result);
        return result;
      } catch (error) {
        const duration_ms = Date.now() - startTime;

        if (error instanceof ZipcodeNotFoundException) {
          this.logger.warn({ event: 'zipcode_not_found', provider: provider.name, zipcode, duration_ms });
          notFoundByAnyProvider = true;
          continue;
        }

        const reason = error instanceof ProviderTimeoutException
          ? this.i18nService.t('zipcode.timeout', { provider: provider.name, ms: error.timeoutMs })
          : error instanceof Error ? error.message : String(error);

        this.logger.warn({ event: 'provider_failed', provider: provider.name, zipcode, duration_ms, reason });
        failures.push({ provider: provider.name, reason });
      }
    }

    if (notFoundByAnyProvider) {
      throw new ZipcodeNotFoundException(
        cacheKey,
        this.i18nService.t('exceptions.zipcode_not_found', { zipcode: cacheKey }),
      );
    }

    this.logger.error({ event: 'all_providers_unavailable', zipcode, failures });
    throw new AllProvidersUnavailableException(
      this.i18nService.t('exceptions.all_providers_unavailable', { zipcode }),
      failures,
    );
  }

  private getProvidersRoundRobin(): ZipcodeProvider[] {
    const shuffled = [...this.providers];
    const temp = shuffled[0];
    shuffled[0] = shuffled[this.currentProviderIndex % shuffled.length];
    shuffled[this.currentProviderIndex % shuffled.length] = temp;
    this.currentProviderIndex = (this.currentProviderIndex + 1) % shuffled.length;
    return shuffled;
  }

}
