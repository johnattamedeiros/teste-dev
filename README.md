# CEP API

API de consulta de CEP brasileiro com fallback automático entre múltiplos provedores externos.

## Stack

- **NestJS 10 + TypeScript**
- **@nestjs/axios** — chamadas HTTP aos provedores
- **@nestjs/cache-manager** — cache em memória com TTL de 1 hora (substituível por Redis)
- **Winston** — logging estruturado (texto colorido em dev, JSON em produção)
- **i18next** — internacionalização das mensagens de erro (PT/EN)
- **Jest** — testes unitários

## Como rodar

```bash
npm install

# desenvolvimento (hot-reload)
npm run start:dev

# produção
npm run build && npm run start:prod
```

A API sobe em `http://localhost:3000`.

## Endpoints

### Consultar CEP

```
GET /cep/:cep
GET /cep/:cep?lang=en
```

Formatos aceitos: `12345-678` ou `12345678`.

O parâmetro `?lang=en` afeta apenas as **mensagens de erro** (padrão: português). O contrato de resposta é único, sempre com campos em português, independente do provider que respondeu.

**Sucesso (200)**
```json
{
  "cep": "01310-100",
  "logradouro": "Avenida Paulista",
  "bairro": "Bela Vista",
  "cidade": "São Paulo",
  "estado": "SP"
}
```

**CEP não encontrado (404)**
```json
{
  "statusCode": 404,
  "error": "Not Found",
  "message": "CEP 99999-999 não encontrado",
  "requestId": "f47ac10b-58cc-4372-a567-0e02b2c3d479"
}
```

**CEP inválido (400)**
```json
{
  "statusCode": 400,
  "message": ["CEP deve estar no formato 12345-678 ou 12345678"],
  "error": "Bad Request"
}
```

**Todos os provedores falharam (502)**
```json
{
  "statusCode": 502,
  "error": "Bad Gateway",
  "message": "Não foi possível consultar o CEP 00000-000. Todos os provedores estão indisponíveis.",
  "details": [
    { "provider": "ViaCEP", "reason": "ViaCEP não respondeu em 10000ms (timeout)" },
    { "provider": "BrasilAPI", "reason": "ViaCEP não respondeu em 10000ms (timeout)" }
  ],
  "requestId": "f47ac10b-58cc-4372-a567-0e02b2c3d479"
}
```

### Health check

```
GET /health
```

```json
{
  "status": "ok",
  "uptime_seconds": 3600,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "providers": ["ViaCEP", "BrasilAPI"]
}
```

## Arquitetura

O `ZipcodeService` verifica o cache antes de consultar qualquer provider. Em caso de miss, percorre os providers em round-robin. O fallback é inteligente:

- **Provider retorna sucesso** → armazena no cache e retorna imediatamente
- **Provider retorna 404** → tenta o próximo provider
- **Provider dá timeout ou erro de rede** → tenta o próximo provider
- **Todos confirmaram que o CEP não existe** → 404
- **Todos falharam por indisponibilidade** → 502 com detalhes de cada falha

### Adicionando um novo provider

Basta adicionar uma entrada no array em [src/zipcode/providers.config.ts](src/zipcode/providers.config.ts):

```ts
{
  name: 'PostmonAPI',
  url: 'https://api.postmon.com.br/v1/cep',
  fieldMap: {
    zipcode: 'cep',
    state: 'estado',
    city: 'cidade',
    neighborhood: 'bairro',
    street: 'logradouro',
  },
}
```

Nenhuma outra alteração é necessária. O `fieldMap` mapeia os campos da API externa para o contrato interno — cada provider pode ter estrutura diferente.

> Se o provider exigir lógica customizada (autenticação, URL composta, resposta aninhada), estenda `BaseZipcodeProvider` e registre no módulo.

### Estrutura

```
src/
├── common/
│   ├── correlation-id.middleware.ts  # gera X-Request-ID, inicializa AsyncLocalStorage
│   ├── logging.interceptor.ts        # loga request_received e request_completed (sucesso)
│   ├── request-context.ts            # AsyncLocalStorage: requestId, startTime, language
│   ├── winston-logger.service.ts     # logger estruturado, injeta requestId em todo log
│   └── filters/
│       └── app-exception.filter.ts  # mapeia exceções de domínio → HTTP; loga request_completed (erros)
├── health/                           # GET /health
├── i18n/
│   ├── i18n.service.ts              # tradução por request via RequestContext.language
│   └── locales/{pt,en}/translation.json
├── observability/
│   └── otel.setup.ts                # OpenTelemetry/Dynatrace (ativado via OTEL_ENABLED=true)
└── zipcode/
    ├── constants/providers.constants.ts   # tokens de injeção, timeout, TTL de cache
    ├── dto/get-zipcode.dto.ts             # validação do formato do CEP
    ├── exceptions/                        # ZipcodeNotFoundException, ProviderTimeoutException, AllProvidersUnavailableException
    ├── interfaces/zipcode.interface.ts    # ZipcodeResponse, ZipcodeProvider, ProviderConfig, FieldMap
    ├── providers/
    │   ├── base-zipcode.provider.ts           # HTTP, timeout RxJS, mapeamento de erros tipados
    │   └── configurable-zipcode.provider.ts   # provider genérico via fieldMap
    ├── providers.config.ts            # configuração dos providers ativos (ViaCEP, BrasilAPI)
    ├── zipcode.controller.ts
    ├── zipcode.module.ts
    └── zipcode.service.ts
```

## Cache

Configurado em `zipcode.module.ts` com TTL de 1 hora. Para trocar para Redis em produção, nenhuma outra parte do código precisa mudar — o service depende apenas da interface `Cache`:

```ts
// Redis (produção)
import { redisStore } from 'cache-manager-redis-yet';
CacheModule.registerAsync({
  useFactory: async () => ({
    store: await redisStore({ socket: { host: 'localhost', port: 6379 } }),
    ttl: CACHE_TTL_MS,
  }),
})
```

## Observabilidade

Cada requisição recebe um **Correlation ID** (UUID gerado automaticamente ou repassado via header `X-Request-ID`). Todos os logs da mesma requisição compartilham o `requestId`.

| Camada | Eventos registrados |
|--------|---------------------|
| HTTP | `request_received`, `request_completed` com `statusCode` e `duration_ms` |
| Service | `cache_hit`, `provider_attempt`, `provider_success`, `provider_failed`, `zipcode_not_found`, `all_providers_unavailable` |
| Provider | `provider_timeout`, `provider_network_error`, `provider_zipcode_not_found` |

**Formato em desenvolvimento** — texto colorido:
```
info [ZipcodeService] (abc-123) cache_hit {"zipcode":"01310100"}
debug [ZipcodeService] (abc-123) provider_attempt {"provider":"ViaCEP","zipcode":"01310100"}
info [ZipcodeService] (abc-123) provider_success {"provider":"ViaCEP","zipcode":"01310100","duration_ms":187}
```

**Formato em produção** (`NODE_ENV=production`) — JSON estruturado:
```json
{
  "level": "info",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "context": "ZipcodeService",
  "requestId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "event": "provider_success",
  "provider": "ViaCEP",
  "zipcode": "01310100",
  "duration_ms": 187
}
```

### Evolução futura — Dynatrace (ou qualquer backend OTLP)

Com **uma variável de ambiente** e **três pacotes npm**, sem nenhuma alteração no código de negócio:

```bash
npm install @opentelemetry/sdk-node \
            @opentelemetry/auto-instrumentations-node \
            @opentelemetry/exporter-trace-otlp-http
```

```env
OTEL_ENABLED=true
OTEL_SERVICE_NAME=cep-api
OTEL_EXPORTER_OTLP_ENDPOINT=https://<tenant>.live.dynatrace.com/api/v2/otlp
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Api-Token <seu-token>
```

O arquivo [src/observability/otel.setup.ts](src/observability/otel.setup.ts) já contém a configuração completa. Alternativamente, o **Dynatrace OneAgent** instrumenta o processo automaticamente via bytecode — zero código.

## Variáveis de ambiente

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `PORT` | `3000` | Porta da aplicação |
| `NODE_ENV` | `development` | `development` = logs coloridos, `production` = JSON |
| `PROVIDER_TIMEOUT` | `10000` | Timeout por provider em ms |
| `OTEL_ENABLED` | `false` | Ativa instrumentação OpenTelemetry |
| `OTEL_SERVICE_NAME` | `cep-api` | Nome do serviço reportado ao backend OTLP |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | — | URL do coletor OTLP |
| `OTEL_EXPORTER_OTLP_HEADERS` | — | Headers de autenticação (ex: `Authorization=Api-Token ...`) |

## Testes

```bash
npm run test        # unitários
npm run test:watch  # modo watch
npm run test:cov    # com cobertura
```
