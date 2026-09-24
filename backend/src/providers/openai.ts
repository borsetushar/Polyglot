import OpenAI from 'openai';

import { getModelConfig } from '../config/models.js';
import { createProviderError } from '../utils/errors.js';

import type {
    CompletionRequest,
    CompletionResponse,
    ContentBlock,
    Provider,
    StreamEvent,
    Usage,
} from './types.js';

export class OpenAIProvider implements Provider {
    readonly name = 'openai';

    private client: OpenAI;

    constructor(apiKey: string) {
        this.client = new OpenAI({
            apiKey,
        });
    }

    async complete(
        req: CompletionRequest
    ): Promise<CompletionResponse> {
        try {
            const config = getModelConfig(req.model);

            const input = req.messages
                .filter((message) => message.role !== 'tool')
                .map((message) => ({
                    role: message.role === 'assistant' ? 'assistant' as const : 'user' as const,
                    content: message.content
                        .filter((block) => block.type === 'text')
                        .map((block) => block.text ?? '')
                        .join(''),
                }));

            const response = await this.client.responses.create({
                model: config.providerModelId,
                input,
                ...(req.system !== undefined && {
                    instructions: req.system,
                }),
                ...(req.maxTokens !== undefined && {
                    max_output_tokens: req.maxTokens,
                }),
                ...(req.signal !== undefined && {
                    signal: req.signal,
                }),
            });

            const content: ContentBlock[] = [
                {
                    type: 'text',
                    text: response.output_text,
                },
            ];

            const usage: Usage = {
                inputTokens: response.usage?.input_tokens ?? 0,
                outputTokens: response.usage?.output_tokens ?? 0,
            };

            return {
                content,
                usage,
                finishReason: 'stop',
            };
        } catch (error) {
            throw this.normalizeError(error);
        }
    }

    async *stream(
        req: CompletionRequest
    ): AsyncIterable<StreamEvent> {
        try {
            const config = getModelConfig(req.model);

            const input = req.messages
                .filter((message) => message.role !== 'tool')
                .map((message) => ({
                    role: message.role === 'assistant' ? 'assistant' as const : 'user' as const,
                    content: message.content
                        .filter((block) => block.type === 'text')
                        .map((block) => block.text ?? '')
                        .join(''),
                }));

            const stream = await this.client.responses.create({
                model: config.providerModelId,
                input,
                stream: true,
                ...(req.system !== undefined && {
                    instructions: req.system,
                }),
                ...(req.maxTokens !== undefined && {
                    max_output_tokens: req.maxTokens,
                }),
                ...(req.signal !== undefined && {
                    signal: req.signal,
                }),
            });

            for await (const event of stream) {
                if (req.signal?.aborted) {
                    return;
                }

                if (event.type === 'response.output_text.delta') {
                    yield {
                        type: 'text_delta',
                        text: event.delta,
                    };
                }

                if (event.type === 'response.completed') {
                    const usage = event.response.usage;

                    if (usage) {
                        yield {
                            type: 'usage',
                            usage: {
                                inputTokens: usage.input_tokens,
                                outputTokens: usage.output_tokens,
                            },
                        };
                    }

                    yield {
                        type: 'done',
                        finishReason: 'stop',
                    };
                }
            }
        } catch (error) {
            yield {
                type: 'error',
                error: this.normalizeError(error),
            };
        }
    }

    async embed(): Promise<number[][]> {
        throw new Error(
            'OpenAI embeddings will be implemented through the embedding abstraction'
        );
    }

    private normalizeError(error: unknown) {
        if (error instanceof OpenAI.RateLimitError) {
            return createProviderError(
                'rate_limit',
                this.name,
                'OpenAI rate limit or quota exceeded',
                true,
                error
            );
        }

        if (error instanceof OpenAI.AuthenticationError) {
            return createProviderError(
                'auth',
                this.name,
                'OpenAI authentication failed',
                false,
                error
            );
        }

        if (error instanceof OpenAI.BadRequestError) {
            return createProviderError(
                'bad_request',
                this.name,
                'OpenAI rejected the request',
                false,
                error
            );
        }

        if (error instanceof OpenAI.APIConnectionTimeoutError) {
            return createProviderError(
                'timeout',
                this.name,
                'OpenAI request timed out',
                true,
                error
            );
        }

        if (error instanceof OpenAI.InternalServerError) {
            return createProviderError(
                'server_error',
                this.name,
                'OpenAI server error',
                true,
                error
            );
        }

        return createProviderError(
            'server_error',
            this.name,
            'Unexpected OpenAI provider error',
            false,
            error
        );
    }
}