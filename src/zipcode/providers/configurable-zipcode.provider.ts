import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { BaseZipcodeProvider } from './base-zipcode.provider';
import { ZipcodeResponse, ProviderConfig } from '../interfaces/zipcode.interface';
import { PROVIDER_TIMEOUT } from '../constants/providers.constants';
import { I18nService } from '../../i18n/i18n.service';

@Injectable()
export class ConfigurableZipcodeProvider extends BaseZipcodeProvider {
  name: string;
  protected apiUrl: string;
  protected timeoutMs: number;
  private readonly urlSuffix: string;
  private readonly fieldMap: ProviderConfig['fieldMap'];

  constructor(
    config: ProviderConfig,
    httpService: HttpService,
    i18nService: I18nService,
  ) {
    super(httpService, i18nService);
    this.name = config.name;
    this.apiUrl = config.url;
    this.urlSuffix = config.urlSuffix ?? '';
    this.timeoutMs = config.timeout ?? PROVIDER_TIMEOUT;
    this.fieldMap = config.fieldMap;
  }

  protected buildUrl(cleanZipcode: string): string {
    return `${this.apiUrl}/${cleanZipcode}${this.urlSuffix}`;
  }

  protected normalizeZipcodeResponse(data: any): ZipcodeResponse {
    return {
      zipcode: data[this.fieldMap.zipcode],
      state: data[this.fieldMap.state],
      city: data[this.fieldMap.city],
      neighborhood: data[this.fieldMap.neighborhood],
      street: data[this.fieldMap.street],
    };
  }
}
