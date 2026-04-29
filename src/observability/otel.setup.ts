/**
 * Instrumentação OpenTelemetry — virada de chave para Dynatrace (ou qualquer backend OTLP).
 *
 * ATIVAÇÃO:
 *   1. Instale os pacotes:
 *        npm install @opentelemetry/sdk-node \
 *                    @opentelemetry/auto-instrumentations-node \
 *                    @opentelemetry/exporter-trace-otlp-http
 *
 *   2. Configure as variáveis de ambiente (.env):
 *        OTEL_ENABLED=true
 *        OTEL_SERVICE_NAME=cep-api
 *        OTEL_EXPORTER_OTLP_ENDPOINT=https://<tenant>.live.dynatrace.com/api/v2/otlp
 *        OTEL_EXPORTER_OTLP_HEADERS=Authorization=Api-Token <seu-token>
 *
 * ALTERNATIVA SEM CÓDIGO — Dynatrace OneAgent:
 *   Instale o OneAgent no servidor e ele instrumenta Node.js automaticamente
 *   via injeção de bytecode. Zero alterações no código da aplicação.
 *   Ref: https://docs.dynatrace.com/docs/setup-and-configuration/setup-on-cloud-platforms
 *
 * COMO FUNCIONA APÓS A ATIVAÇÃO:
 *   - Cada requisição HTTP recebe um traceId + spanId automáticos
 *   - O WinstonLoggerService já emite JSON estruturado — o Dynatrace correlaciona
 *     os logs ao trace via requestId (que pode ser substituído pelo traceId do OTel)
 *   - NestJS HTTP, Axios (providers externos) e Cache são instrumentados automaticamente
 */
export function setupOTel(): void {
  if (process.env.OTEL_ENABLED !== 'true') return;

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { NodeSDK } = require('@opentelemetry/sdk-node');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');

    const sdk = new NodeSDK({
      serviceName: process.env.OTEL_SERVICE_NAME ?? 'cep-api',
      traceExporter: new OTLPTraceExporter(),
      instrumentations: [getNodeAutoInstrumentations()],
    });

    sdk.start();

    process.on('SIGTERM', () => {
      sdk.shutdown().catch((err: Error) =>
        console.error('[OTel] Erro ao encerrar SDK:', err),
      );
    });

    console.log(
      `[OTel] Ativo — exportando para ${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}`,
    );
  } catch {
    console.error(
      '[OTel] Pacotes não encontrados. Execute:\n' +
        '  npm install @opentelemetry/sdk-node ' +
        '@opentelemetry/auto-instrumentations-node ' +
        '@opentelemetry/exporter-trace-otlp-http',
    );
  }
}
