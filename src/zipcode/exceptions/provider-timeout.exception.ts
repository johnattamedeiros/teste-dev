export class ProviderTimeoutException extends Error {
  readonly provider: string;
  readonly timeoutMs: number;

  constructor(provider: string, timeoutMs: number, message: string) {
    super(message);
    this.name = 'ProviderTimeoutException';
    this.provider = provider;
    this.timeoutMs = timeoutMs;
  }
}
