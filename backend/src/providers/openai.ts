import OpenAI from 'openai';
import type {
    ResponseInputItem,
} from 'openai/resources/responses/responses';

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

    private buildTools(
        req: CompletionRequest
    ) {
        return (req.tools ?? []).map((tool) => ({
            type: 'function' as const,
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
            strict: false,
        }));
    }
    private buildInput(
        req: CompletionRequest
    ): ResponseInputItem[] {
        const input: ResponseInputItem[] = [];

        for (const message of req.messages) {
            if (message.role === 'user') {
                input.push({
                    role: 'user',
                    content: message.content
                        .filter(
                            (block) =>
                                block.type === 'text'
                        )
                        .map(
                            (block) =>
                                block.text ?? ''
                        )
                        .join(''),
                });

                continue;
            }

            if (message.role === 'assistant') {
                for (const block of message.content) {
                    if (block.type === 'text') {
                        input.push({
                            role: 'assistant',
                            content:
                                block.text ?? '',
                        });
                    }

                    if (block.type === 'tool_use') {
                        input.push({
                            type: 'function_call',
                            call_id:
                                block.id ?? '',
                            name:
                                block.name ?? '',
                            arguments:
                                JSON.stringify(
                                    block.input ?? {}
                                ),
                        });
                    }
                }

                continue;
            }

            if (message.role === 'tool') {
                for (const block of message.content) {
                    if (block.type === 'tool_result') {
                        input.push({
                            type: 'function_call_output',
                            call_id:
                                block.toolUseId ?? '',
                            output:
                                block.content ?? '',
                        });
                    }
                }
            }
        }

        return input;
    }
    async complete(
        req: CompletionRequest
    ): Promise<CompletionResponse> {
        try {
            const config = getModelConfig(req.model);

            const input = this.buildInput(req);
            const response = await this.client.responses.create({
                model: config.providerModelId,
                input,
                tools: this.buildTools(req),
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
            const content: ContentBlock[] = [];

            for (const item of response.output) {
                if (item.type === 'message') {
                    for (const block of item.content) {
                        if (block.type === 'output_text') {
                            content.push({
                                type: 'text',
                                text: block.text,
                            });
                        }
                    }
                }

                if (item.type === 'function_call') {
                    content.push({
                        type: 'tool_use',
                        id: item.call_id,
                        name: item.name,
                        input: JSON.parse(item.arguments),
                    });
                }
            }

            const usage: Usage = {
                inputTokens: response.usage?.input_tokens ?? 0,
                outputTokens: response.usage?.output_tokens ?? 0,
            };

            return {
                content,
                usage,
                finishReason:
                    content.some(
                        (block) => block.type === 'tool_use'
                    )
                        ? 'tool_use'
                        : 'stop',
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

            const input = this.buildInput(req);
            
            let hasToolCall = false;
            let currentToolCallId = '';
            let currentToolName = '';
            let currentToolArguments = '';

            const stream = await this.client.responses.create({
                model: config.providerModelId,
                input,
                stream: true,
                tools: this.buildTools(req),
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

                if (event.type === 'response.output_item.added') {
                    if (event.item.type === 'function_call') {
                        hasToolCall = true;

                        currentToolCallId = event.item.call_id;
                        currentToolName = event.item.name;
                        currentToolArguments = '';

                        yield {
                            type: 'tool_use_start',
                            id: currentToolCallId,
                            name: currentToolName,
                        };
                    }
                }

                if (
                    event.type ===
                    'response.function_call_arguments.delta'
                ) {
                    currentToolArguments += event.delta;

                    yield {
                        type: 'tool_use_delta',
                        id: currentToolCallId,
                        partialJson: event.delta,
                    };
                }

                if (
                    event.type ===
                    'response.function_call_arguments.done'
                ) {
                    const input =
                        JSON.parse(
                            event.arguments
                        );

                    yield {
                        type: 'tool_use_complete',
                        id: currentToolCallId,
                        name: currentToolName,
                        input,
                    };

                    currentToolArguments = '';
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
                        finishReason: hasToolCall
                            ? 'tool_use'
                            : 'stop',
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