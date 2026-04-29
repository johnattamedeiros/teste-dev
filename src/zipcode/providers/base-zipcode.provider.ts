import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { catchError, firstValueFrom, timeout, TimeoutError } from 'rxjs';
import { AxiosError, AxiosResponse } from 'axios';
import { ZipcodeResponse, ZipcodeProvider } from '../interfaces/zipcode.interface';
import { I18nService } from '../../i18n/i18n.service';
import { ZipcodeNotFoundException } from '../exceptions/zipcode-not-found.exception';
import { ProviderTimeoutException } from '../exceptions/provider-timeout.exception';

@Injectable()
export abstract class BaseZipcodeProvider implements ZipcodeProvider {
  protected logger = new Logger(this.constructor.name);
  abstract name: string;
  protected abstract apiUrl: string;
  protected abstract timeoutMs: number;

  constructor(
    protected httpService: HttpService,
    protected i18nService: I18nService,
  ) {}

  protected abstract normalizeZipcodeResponse(data: any): ZipcodeResponse;

  protected buildUrl(cleanZipcode: string): string {
    return `${this.apiUrl}/${cleanZipcode}`;
  }

  async getZipcode(zipcode: string): Promise<ZipcodeResponse> {
    const cleanZipcode = zipcode.replace('-', '');

    let response: AxiosResponse<any>;

    try {
      response = await firstValueFrom(
        this.httpService
          .get(this.buildUrl(cleanZipcode))
          .pipe(
            timeout(this.timeoutMs),
            catchError((error: AxiosError | TimeoutError) => {
              if (error instanceof TimeoutError) {
                throw new ProviderTimeoutException(
                  this.name,
                  this.timeoutMs,
                  this.i18nService.t('zipcode.timeout', {
                    provider: this.name,
                    ms: this.timeoutMs,
                  }),
                );
              }
              throw error;
            }),
          ),
      );
    } catch (error) {
      if (error instanceof ProviderTimeoutException) {
        this.logger.warn({
          event: 'provider_timeout',
          provider: this.name,
          zipcode: cleanZipcode,
          timeout_ms: this.timeoutMs,
        });
        throw error;
      }

      const axiosError = error as AxiosError;
      this.logger.warn({
        event: 'provider_network_error',
        provider: this.name,
        zipcode: cleanZipcode,
        status: axiosError.response?.status,
        error: axiosError.message,
      });
      throw error;
    }

    if (response.data.erro || response.status === 404) {
      this.logger.warn({
        event: 'provider_zipcode_not_found',
        provider: this.name,
        zipcode: cleanZipcode,
      });
      throw new ZipcodeNotFoundException(
        cleanZipcode,
        this.i18nService.t('exceptions.zipcode_not_found', { zipcode: cleanZipcode }),
      );
    }

    const normalized = this.normalizeZipcodeResponse(response.data);
    this.logger.debug({ event: 'provider_normalized', provider: this.name, zipcode: cleanZipcode });
    return normalized;
  }
}
