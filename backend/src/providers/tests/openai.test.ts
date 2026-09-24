import { describe, expect, it, vi } from 'vitest';

import OpenAI from 'openai';
import { OpenAIProvider } from '../openai.js';

describe('OpenAIProvider', () => {
    it('normalizes an OpenAI response into the common format', async () => {
        const provider = new OpenAIProvider('test-api-key');

        const mockResponse = {
            output_text: 'Hello from mocked OpenAI!',
            usage: {
                input_tokens: 10,
                output_tokens: 5,
            },
        };

        const createMock = vi
            .spyOn((provider as any).client.responses, 'create')
            .mockResolvedValue(mockResponse);

        const response = await provider.complete({
            model: 'openai-luna',
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
        });

        expect(createMock).toHaveBeenCalled();

        expect(response).toEqual({
            content: [
                {
                    type: 'text',
                    text: 'Hello from mocked OpenAI!',
                },
            ],
            usage: {
                inputTokens: 10,
                outputTokens: 5,
            },
            finishReason: 'stop',
        });
    });

    it('normalizes OpenAI rate limit errors', async () => {
        const provider = new OpenAIProvider('test-api-key');

        const rateLimitError = new OpenAI.RateLimitError(
            429,
            {
                message: 'You have no credits remaining',
                type: 'insufficient_quota',
                param: null,
                code: 'credit_balance_exhausted',
            },
            'You have no credits remaining',
            new Headers()
        );

        vi.spyOn((provider as any).client.responses, 'create')
            .mockRejectedValue(rateLimitError);

        await expect(
            provider.complete({
                model: 'openai-luna',
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
            })
        ).rejects.toMatchObject({
            kind: 'rate_limit',
            provider: 'openai',
            retryable: true,
        });
    });
});