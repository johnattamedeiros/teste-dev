export interface ProviderFailure {
  provider: string;
  reason: string;
}

export class AllProvidersUnavailableException extends Error {
  readonly failures: ProviderFailure[];

  constructor(message: string, failures: ProviderFailure[]) {
    super(message);
    this.name = 'AllProvidersUnavailableException';
    this.failures = failures;
  }
}
