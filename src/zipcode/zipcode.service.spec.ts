import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ZipcodeService } from './zipcode.service';
import { ZIPCODE_PROVIDERS_TOKEN } from './constants/providers.constants';
import { I18nService } from '../i18n/i18n.service';
import { ZipcodeProvider, ZipcodeResponse } from './interfaces/zipcode.interface';
import { ZipcodeNotFoundException } from './exceptions/zipcode-not-found.exception';
import { ProviderTimeoutException } from './exceptions/provider-timeout.exception';
import { AllProvidersUnavailableException } from './exceptions/all-providers-unavailable.exception';

const mockResponse: ZipcodeResponse = {
  zipcode: '01310-100',
  state: 'SP',
  city: 'São Paulo',
  neighborhood: 'Bela Vista',
  street: 'Avenida Paulista',
};

const makeProvider = (name: string): jest.Mocked<ZipcodeProvider> => ({
  name,
  getZipcode: jest.fn(),
});

describe('ZipcodeService', () => {
  let service: ZipcodeService;
  let providerA: jest.Mocked<ZipcodeProvider>;
  let providerB: jest.Mocked<ZipcodeProvider>;
  let cache: { get: jest.Mock; set: jest.Mock };

  beforeEach(async () => {
    providerA = makeProvider('ProviderA');
    providerB = makeProvider('ProviderB');
    cache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ZipcodeService,
        { provide: ZIPCODE_PROVIDERS_TOKEN, useValue: [providerA, providerB] },
        { provide: CACHE_MANAGER, useValue: cache },
        { provide: I18nService, useValue: { t: (key: string) => key } },
      ],
    }).compile();

    service = module.get<ZipcodeService>(ZipcodeService);
  });

  describe('cache', () => {
    it('retorna resultado em cache sem chamar nenhum provider', async () => {
      cache.get.mockResolvedValue(mockResponse);

      const result = await service.searchZipcode('01310-100');

      expect(result).toEqual(mockResponse);
      expect(providerA.getZipcode).not.toHaveBeenCalled();
      expect(providerB.getZipcode).not.toHaveBeenCalled();
    });

    it('armazena resultado no cache após busca bem-sucedida', async () => {
      providerA.getZipcode.mockResolvedValue(mockResponse);

      await service.searchZipcode('01310-100');

      expect(cache.set).toHaveBeenCalledWith('01310100', mockResponse);
    });
  });

  describe('fallback entre providers', () => {
    it('tenta o segundo provider quando o primeiro falha com erro de rede', async () => {
      providerA.getZipcode.mockRejectedValue(new Error('Connection refused'));
      providerB.getZipcode.mockResolvedValue(mockResponse);

      const result = await service.searchZipcode('01310-100');

      expect(result).toEqual(mockResponse);
      expect(providerA.getZipcode).toHaveBeenCalled();
      expect(providerB.getZipcode).toHaveBeenCalled();
    });

    it('tenta o segundo provider quando o primeiro atinge timeout', async () => {
      providerA.getZipcode.mockRejectedValue(
        new ProviderTimeoutException('ProviderA', 10000, 'timeout'),
      );
      providerB.getZipcode.mockResolvedValue(mockResponse);

      const result = await service.searchZipcode('01310-100');

      expect(result).toEqual(mockResponse);
      expect(providerB.getZipcode).toHaveBeenCalled();
    });
  });

  describe('CEP não encontrado', () => {
    it('tenta o segundo provider antes de retornar 404', async () => {
      providerA.getZipcode.mockRejectedValue(
        new ZipcodeNotFoundException('99999999', 'CEP não encontrado'),
      );
      providerB.getZipcode.mockResolvedValue(mockResponse);

      const result = await service.searchZipcode('99999-999');

      expect(result).toEqual(mockResponse);
      expect(providerB.getZipcode).toHaveBeenCalled();
    });

    it('lança ZipcodeNotFoundException somente quando todos os providers confirmam não encontrado', async () => {
      providerA.getZipcode.mockRejectedValue(
        new ZipcodeNotFoundException('99999999', 'CEP não encontrado'),
      );
      providerB.getZipcode.mockRejectedValue(
        new ZipcodeNotFoundException('99999999', 'CEP não encontrado'),
      );

      await expect(service.searchZipcode('99999-999')).rejects.toThrow(ZipcodeNotFoundException);
    });

    it('lança ZipcodeNotFoundException se um provider confirma não encontrado mesmo que outro timeout', async () => {
      providerA.getZipcode.mockRejectedValue(
        new ZipcodeNotFoundException('99999999', 'CEP não encontrado'),
      );
      providerB.getZipcode.mockRejectedValue(
        new ProviderTimeoutException('ProviderB', 10000, 'timeout'),
      );

      await expect(service.searchZipcode('99999-999')).rejects.toThrow(ZipcodeNotFoundException);
    });
  });

  describe('todos os providers indisponíveis', () => {
    it('lança AllProvidersUnavailableException quando todos falham', async () => {
      providerA.getZipcode.mockRejectedValue(new Error('timeout'));
      providerB.getZipcode.mockRejectedValue(new Error('timeout'));

      await expect(service.searchZipcode('01310-100')).rejects.toThrow(
        AllProvidersUnavailableException,
      );
    });

    it('inclui o motivo de falha de cada provider no erro', async () => {
      providerA.getZipcode.mockRejectedValue(new Error('ECONNREFUSED'));
      providerB.getZipcode.mockRejectedValue(
        new ProviderTimeoutException('ProviderB', 10000, 'timeout'),
      );

      const error = await service.searchZipcode('01310-100').catch((e) => e);

      expect(error).toBeInstanceOf(AllProvidersUnavailableException);
      expect(error.failures).toHaveLength(2);
      expect(error.failures[0].provider).toBe('ProviderA');
      expect(error.failures[1].provider).toBe('ProviderB');
    });
  });
});
