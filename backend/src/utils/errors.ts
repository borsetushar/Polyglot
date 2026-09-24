import type {
  ErrorKind,
  ProviderError,
} from '../providers/types.js';

export function createProviderError(
  kind: ErrorKind,
  provider: string,
  message: string,
  retryable: boolean,
  raw?: unknown,
  retryAfterMs?: number
): ProviderError {
  const error = new Error(message) as ProviderError;

  error.kind = kind;
  error.provider = provider;
  error.retryable = retryable;

  if (retryAfterMs !== undefined) {
    error.retryAfterMs = retryAfterMs;
  }

  if (raw !== undefined) {
    error.raw = raw;
  }

  return error;
}