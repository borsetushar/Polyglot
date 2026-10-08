import type {
  CompletionRequest,
  CompletionResponse,
  Provider,
  StreamEvent,
} from './types.js';

export interface ResilienceOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  fallbackProviders?: string[];
}

export async function completeWithResilience(
  provider: Provider,
  request: CompletionRequest,
  getProvider: (name: string) => Provider,
  options: ResilienceOptions = {}
): Promise<CompletionResponse> {
  const maxRetries = options.maxRetries ?? 2;
  const baseDelayMs = options.baseDelayMs ?? 300;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await provider.complete(request);
    } catch (error) {
      lastError = error;

      if (
        !isRetryable(error) ||
        attempt === maxRetries
      ) {
        break;
      }

      await delay(
        getBackoffDelay(
          attempt,
          baseDelayMs
        )
      );
    }
  }

  for (
    const fallbackName of
    options.fallbackProviders ?? []
  ) {
    try {
      const fallback =
        getProvider(fallbackName);

      return await fallback.complete(
        request
      );
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

function isRetryable(
  error: unknown
): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'retryable' in error &&
    (error as { retryable?: unknown })
      .retryable === true
  );
}

function getBackoffDelay(
  attempt: number,
  baseDelayMs: number
): number {
  return (
    baseDelayMs *
    Math.pow(2, attempt)
  );
}

function delay(
  ms: number
): Promise<void> {
  return new Promise((resolve) =>
    setTimeout(resolve, ms)
  );
}