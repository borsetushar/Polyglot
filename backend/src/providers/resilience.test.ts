import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  completeWithResilience,
} from './resilience.js';

import type {
  CompletionRequest,
  CompletionResponse,
  Provider,
} from './types.js';

import {
  createProviderError,
} from '../utils/errors.js';

const request: CompletionRequest = {
  model: 'test-model',
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'Hello',
        },
      ],
    },
  ],
};

function successResponse(
  text: string
): CompletionResponse {
  return {
    content: [
      {
        type: 'text',
        text,
      },
    ],
    usage: {
      inputTokens: 10,
      outputTokens: 5,
    },
    finishReason: 'stop',
  };
}

function createProvider(
  name: string,
  complete: Provider['complete']
): Provider {
  return {
    name,
    complete,
    async *stream() {},
  };
}

describe('provider resilience', () => {
  it(
    'retries a retryable error and then falls back',
    async () => {
      let primaryAttempts = 0;

      const primary =
        createProvider(
          'openai',
          async () => {
            primaryAttempts++;

            throw createProviderError(
              'server_error',
              'openai',
              'Temporary failure',
              true
            );
          }
        );

      const fallback =
        createProvider(
          'gemini',
          async () =>
            successResponse(
              'Gemini response'
            )
        );

      const providers = new Map([
        ['openai', primary],
        ['gemini', fallback],
      ]);

      const response =
        await completeWithResilience(
          primary,
          request,
          (name) => {
            const provider =
              providers.get(name);

            if (!provider) {
              throw new Error(
                `Provider ${name} not found`
              );
            }

            return provider;
          },
          {
            maxRetries: 2,
            baseDelayMs: 1,
            fallbackProviders: [
              'gemini',
            ],
          }
        );

      expect(
        primaryAttempts
      ).toBe(3);

      expect(
        response.content[0]
      ).toEqual({
        type: 'text',
        text: 'Gemini response',
      });
    }
  );

  it(
    'does not retry a non-retryable error',
    async () => {
      let attempts = 0;

      const provider =
        createProvider(
          'openai',
          async () => {
            attempts++;

            throw createProviderError(
              'auth',
              'openai',
              'Authentication failed',
              false
            );
          }
        );

      await expect(
        completeWithResilience(
          provider,
          request,
          () => provider,
          {
            maxRetries: 2,
            baseDelayMs: 1,
          }
        )
      ).rejects.toThrow(
        'Authentication failed'
      );

      expect(attempts).toBe(1);
    }
  );
});