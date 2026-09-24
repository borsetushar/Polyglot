import Anthropic from '@anthropic-ai/sdk';
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

export class AnthropicProvider implements Provider {
    readonly name = 'anthropic';

    private client: Anthropic;

    constructor(apiKey: string) {
        this.client = new Anthropic({
            apiKey,
        });
    }

    async complete(
        req: CompletionRequest
    ): Promise<CompletionResponse> {
        try {
            const messages = req.messages
                .filter((message) => message.role !== 'tool')
                .map((message) => ({
                    role:
                        message.role === 'assistant'
                            ? ('assistant' as const)
                            : ('user' as const),

                    content: message.content
                        .filter((block) => block.type === 'text')
                        .map((block) => ({
                            type: 'text' as const,
                            text: block.text ?? '',
                        })),
                }));

            const request = {
                model: getModelConfig(req.model).providerModelId,
                max_tokens: req.maxTokens ?? 1024,
                messages,
                ...(req.temperature !== undefined && {
                    temperature: req.temperature,
                }),
                ...(req.system !== undefined && {
                    system: req.system,
                }),
            };

            const response = await this.client.messages.create(request);

            const content: ContentBlock[] = response.content
                .filter((block) => block.type === 'text')
                .map((block) => ({
                    type: 'text' as const,
                    text: block.text,
                }));

            const usage: Usage = {
                inputTokens: response.usage.input_tokens,
                outputTokens: response.usage.output_tokens,
            };

            const finishReason =
                response.stop_reason === 'max_tokens'
                    ? 'max_tokens'
                    : response.stop_reason === 'tool_use'
                        ? 'tool_use'
                        : 'stop';

            return {
                content,
                usage,
                finishReason,
            };
        } catch (error) {
            if (error instanceof Anthropic.AuthenticationError) {
                throw createProviderError(
                    'auth',
                    this.name,
                    'Anthropic authentication failed',
                    false,
                    error
                );
            }

            if (error instanceof Anthropic.RateLimitError) {
                throw createProviderError(
                    'rate_limit',
                    this.name,
                    'Anthropic rate limit exceeded',
                    true,
                    error
                );
            }

            if (error instanceof Anthropic.BadRequestError) {
                throw createProviderError(
                    'bad_request',
                    this.name,
                    'Anthropic rejected the request',
                    false,
                    error
                );
            }

            if (error instanceof Anthropic.APIConnectionTimeoutError) {
                throw createProviderError(
                    'timeout',
                    this.name,
                    'Anthropic request timed out',
                    true,
                    error
                );
            }

            if (error instanceof Anthropic.InternalServerError) {
                throw createProviderError(
                    'server_error',
                    this.name,
                    'Anthropic server error',
                    true,
                    error
                );
            }

            throw createProviderError(
                'server_error',
                this.name,
                'Unexpected Anthropic provider error',
                false,
                error
            );
        }
    }

    async *stream(
        req: CompletionRequest
    ): AsyncIterable<StreamEvent> {
        try {
            const messages = req.messages
                .filter((message) => message.role !== 'tool')
                .map((message) => ({
                    role:
                        message.role === 'assistant'
                            ? ('assistant' as const)
                            : ('user' as const),

                    content: message.content
                        .filter((block) => block.type === 'text')
                        .map((block) => ({
                            type: 'text' as const,
                            text: block.text ?? '',
                        })),
                }));

            const request = {
                model: getModelConfig(req.model).providerModelId,
                max_tokens: req.maxTokens ?? 1024,
                messages,
                stream: true as const,
                ...(req.temperature !== undefined && {
                    temperature: req.temperature,
                }),
                ...(req.system !== undefined && {
                    system: req.system,
                }),
            };

            const stream = await this.client.messages.create(request);

            for await (const event of stream) {
                if (event.type === 'content_block_delta') {
                    if (event.delta.type === 'text_delta') {
                        yield {
                            type: 'text_delta',
                            text: event.delta.text,
                        };
                    }
                }

                if (event.type === 'message_delta') {
                    if (event.usage) {
                        yield {
                            type: 'usage',
                            usage: {
                                inputTokens: 0,
                                outputTokens: event.usage.output_tokens,
                            },
                        };
                    }

                    yield {
                        type: 'done',
                        finishReason:
                            event.delta.stop_reason === 'max_tokens'
                                ? 'max_tokens'
                                : event.delta.stop_reason === 'tool_use'
                                    ? 'tool_use'
                                    : 'stop',
                    };
                }
            }
        } catch (error) {
            if (error instanceof Anthropic.AuthenticationError) {
                yield {
                    type: 'error',
                    error: createProviderError(
                        'auth',
                        this.name,
                        'Anthropic authentication failed',
                        false,
                        error
                    ),
                };
                return;
            }

            if (error instanceof Anthropic.RateLimitError) {
                yield {
                    type: 'error',
                    error: createProviderError(
                        'rate_limit',
                        this.name,
                        'Anthropic rate limit exceeded',
                        true,
                        error
                    ),
                };
                return;
            }

            if (error instanceof Anthropic.APIConnectionTimeoutError) {
                yield {
                    type: 'error',
                    error: createProviderError(
                        'timeout',
                        this.name,
                        'Anthropic request timed out',
                        true,
                        error
                    ),
                };
                return;
            }

            yield {
                type: 'error',
                error: createProviderError(
                    'server_error',
                    this.name,
                    'Unexpected Anthropic provider error',
                    false,
                    error
                ),
            };
        }
    }

    async embed(): Promise<number[][]> {
        throw new Error(
            'Anthropic does not provide embeddings through this adapter'
        );
    }
}