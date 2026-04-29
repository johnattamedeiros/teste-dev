import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContextData {
  requestId: string;
  startTime: number;
  language: string;
}

const storage = new AsyncLocalStorage<RequestContextData>();

export class RequestContext {
  static run(data: RequestContextData, fn: (...args: any[]) => void): void {
    storage.run(data, fn);
  }

  static get(): RequestContextData | undefined {
    return storage.getStore();
  }
}
