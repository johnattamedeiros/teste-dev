import { ArgumentsHost, HttpException } from '@nestjs/common';
import { AppExceptionFilter } from './app-exception.filter';
import { ZipcodeNotFoundException } from '../../zipcode/exceptions/zipcode-not-found.exception';
import { AllProvidersUnavailableException } from '../../zipcode/exceptions/all-providers-unavailable.exception';
import { I18nService } from '../../i18n/i18n.service';

const mockJson = jest.fn();
const mockStatus = jest.fn().mockReturnValue({ json: mockJson });

const makeHost = (url = '/cep/test'): ArgumentsHost =>
  ({
    switchToHttp: () => ({
      getResponse: () => ({ status: mockStatus }),
      getRequest: () => ({ url }),
    }),
  }) as unknown as ArgumentsHost;

const i18nStub = { t: (key: string) => key } as unknown as I18nService;

describe('AppExceptionFilter', () => {
  let filter: AppExceptionFilter;

  beforeEach(() => {
    jest.clearAllMocks();
    mockStatus.mockReturnValue({ json: mockJson });
    filter = new AppExceptionFilter(i18nStub);
  });

  it('mapeia ZipcodeNotFoundException para 404', () => {
    filter.catch(new ZipcodeNotFoundException('99999999', 'CEP não encontrado'), makeHost());

    expect(mockStatus).toHaveBeenCalledWith(404);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 404, error: 'Not Found' }),
    );
  });

  it('mapeia AllProvidersUnavailableException para 502 com details', () => {
    const failures = [{ provider: 'ViaCEP', reason: 'timeout' }];
    filter.catch(new AllProvidersUnavailableException('todos falharam', failures), makeHost());

    expect(mockStatus).toHaveBeenCalledWith(502);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 502, error: 'Bad Gateway', details: failures }),
    );
  });

  it('repassa o status original de uma HttpException', () => {
    filter.catch(new HttpException('Bad Request', 400), makeHost());

    expect(mockStatus).toHaveBeenCalledWith(400);
  });

  it('mapeia exceção desconhecida para 500', () => {
    filter.catch(new Error('falha inesperada'), makeHost());

    expect(mockStatus).toHaveBeenCalledWith(500);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 500, error: 'Internal Server Error' }),
    );
  });

  it('sempre inclui o campo requestId na resposta', () => {
    filter.catch(new ZipcodeNotFoundException('12345678', 'não encontrado'), makeHost());

    const payload = mockJson.mock.calls[0][0];
    expect(payload).toHaveProperty('requestId');
  });

  it('loga request_completed com statusCode correto para erros', () => {
    const logSpy = jest.spyOn(filter['logger'], 'log');

    filter.catch(new ZipcodeNotFoundException('99999999', 'não encontrado'), makeHost());

    const completedLog = logSpy.mock.calls.find(
      (call) => typeof call[0] === 'object' && call[0].event === 'request_completed',
    );
    expect(completedLog).toBeDefined();
    expect(completedLog![0]).toMatchObject({ event: 'request_completed', statusCode: 404 });
  });
});
