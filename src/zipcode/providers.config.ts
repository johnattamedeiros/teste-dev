import { ProviderConfig } from './interfaces/zipcode.interface';

export const PROVIDERS_CONFIG: ProviderConfig[] = [
  {
    name: 'ViaCEP',
    url: 'https://viacep.com.br/ws',
    urlSuffix: '/json',
    fieldMap: {
      zipcode: 'cep',
      state: 'uf',
      city: 'localidade',
      neighborhood: 'bairro',
      street: 'logradouro',
    },
  },
  {
    name: 'BrasilAPI',
    url: 'https://brasilapi.com.br/api/cep/v1',
    urlSuffix: '',
    fieldMap: {
      zipcode: 'cep',
      state: 'state',
      city: 'city',
      neighborhood: 'neighborhood',
      street: 'street',
    },
  },
];
