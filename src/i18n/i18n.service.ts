import { Injectable } from '@nestjs/common';
import i18next from 'i18next';
import ptTranslations from './locales/pt/translation.json';
import enTranslations from './locales/en/translation.json';
import { RequestContext } from '../common/request-context';

@Injectable()
export class I18nService {
  async initialize() {
    await i18next.init({
      lng: 'pt',
      fallbackLng: 'pt',
      resources: {
        pt: { translation: ptTranslations },
        en: { translation: enTranslations },
      },
    });
  }

  t(key: string, options?: Record<string, any>): string {
    const lng = RequestContext.get()?.language ?? 'pt';
    const result = i18next.t(key, { lng, ...options });
    return typeof result === 'string' ? result : JSON.stringify(result);
  }
}
