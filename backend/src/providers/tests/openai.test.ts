import { describe, expect, it, vi } from 'vitest';

import OpenAI from 'openai';
import { OpenAIProvider } from '../openai.js';

describe('OpenAIProvider', () => {
    it('normalizes an OpenAI response into the common format', async () => {
        const provider = new OpenAIProvider('test-api-key');

        const mockResponse = {
            output_text: 'Hello from mocked OpenAI!',
            output: [
                {
                    type: 'message',
                    content: [
                        {
                            type: 'output_text',
                            text: 'Hello from mocked OpenAI!',
                        },
                    ],
                },
            ],
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

    it('normalizes an OpenAI function call into the common tool_use format', async () => {
        const provider = new OpenAIProvider('test-api-key');

        const mockResponse = {
            output_text: '',
            output: [
                {
                    type: 'function_call',
                    call_id: 'call_weather_1',
                    name: 'weather',
                    arguments: JSON.stringify({
                        city: 'Pune',
                    }),
                },
            ],
            usage: {
                input_tokens: 20,
                output_tokens: 8,
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
                            text: 'What is the weather in Pune?',
                        },
                    ],
                },
            ],
            tools: [
                {
                    name: 'weather',
                    description:
                        'Get the current weather for a city.',
                    parameters: {
                        type: 'object',
                        properties: {
                            city: {
                                type: 'string',
                            },
                        },
                        required: ['city'],
                    },
                },
            ],
        });

        expect(createMock).toHaveBeenCalled();

        expect(response.content).toEqual([
            {
                type: 'tool_use',
                id: 'call_weather_1',
                name: 'weather',
                input: {
                    city: 'Pune',
                },
            },
        ]);

        expect(response.finishReason).toBe('tool_use');

        expect(response.usage).toEqual({
            inputTokens: 20,
            outputTokens: 8,
        });
    });

    it('streams OpenAI function calls into the common tool events', async () => {
        const provider = new OpenAIProvider('test-api-key');

        const mockEvents = [
            {
                type: 'response.output_item.added',
                item: {
                    type: 'function_call',
                    call_id: 'call_weather_1',
                    name: 'weather',
                    arguments: '',
                },
            },
            {
                type: 'response.function_call_arguments.delta',
                delta: '{"city":',
            },
            {
                type: 'response.function_call_arguments.delta',
                delta: '"Pune"}',
            },
            {
                type: 'response.function_call_arguments.done',
                arguments: '{"city":"Pune"}',
            },
            {
                type: 'response.completed',
                response: {
                    usage: {
                        input_tokens: 20,
                        output_tokens: 8,
                    },
                },
            },
        ];

        vi.spyOn(
            (provider as any).client.responses,
            'create'
        ).mockResolvedValue(
            (async function* () {
                for (const event of mockEvents) {
                    yield event;
                }
            })()
        );

        const events = [];

        for await (
            const event of provider.stream({
                model: 'openai-luna',
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: 'What is the weather in Pune?',
                            },
                        ],
                    },
                ],
                tools: [
                    {
                        name: 'weather',
                        description:
                            'Get the current weather for a city.',
                        parameters: {
                            type: 'object',
                            properties: {
                                city: {
                                    type: 'string',
                                },
                            },
                            required: ['city'],
                        },
                    },
                ],
            })
        ) {
            events.push(event);
        }

        expect(events).toEqual([
            {
                type: 'tool_use_start',
                id: 'call_weather_1',
                name: 'weather',
            },
            {
                type: 'tool_use_delta',
                id: 'call_weather_1',
                partialJson: '{"city":',
            },
            {
                type: 'tool_use_delta',
                id: 'call_weather_1',
                partialJson: '"Pune"}',
            },
            {
                type: 'tool_use_complete',
                id: 'call_weather_1',
                name: 'weather',
                input: {
                    city: 'Pune',
                },
            },
            {
                type: 'usage',
                usage: {
                    inputTokens: 20,
                    outputTokens: 8,
                },
            },
            {
                type: 'done',
                finishReason: 'tool_use',
            },
        ]);
    });
    it('sends function_call_output back to OpenAI after a tool call', async () => {
        const provider = new OpenAIProvider('test-api-key');

        const calls: any[] = [];

        const mockStreams = [
            (async function* () {
                yield {
                    type: 'response.output_item.added',
                    item: {
                        type: 'function_call',
                        call_id: 'call_weather_1',
                        name: 'weather',
                        arguments: '',
                    },
                };

                yield {
                    type: 'response.function_call_arguments.delta',
                    delta: '{"city":"Pune"}',
                };

                yield {
                    type: 'response.function_call_arguments.done',
                    arguments: '{"city":"Pune"}',
                };

                yield {
                    type: 'response.completed',
                    response: {
                        usage: {
                            input_tokens: 20,
                            output_tokens: 8,
                        },
                    },
                };
            })(),

            (async function* () {
                yield {
                    type: 'response.output_text.delta',
                    delta: 'The weather in Pune is partly cloudy.',
                };

                yield {
                    type: 'response.completed',
                    response: {
                        usage: {
                            input_tokens: 30,
                            output_tokens: 10,
                        },
                    },
                };
            })(),
        ];

        vi.spyOn(
            (provider as any).client.responses,
            'create'
        ).mockImplementation(async (request: any) => {
            calls.push(request);

            return mockStreams.shift();
        });

        const firstEvents = [];

        for await (
            const event of provider.stream({
                model: 'openai-luna',
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text:
                                    'What is the weather in Pune?',
                            },
                        ],
                    },
                ],
                tools: [
                    {
                        name: 'weather',
                        description:
                            'Get the current weather for a city.',
                        parameters: {
                            type: 'object',
                            properties: {
                                city: {
                                    type: 'string',
                                },
                            },
                            required: ['city'],
                        },
                    },
                ],
            })
        ) {
            firstEvents.push(event);
        }

        expect(firstEvents).toContainEqual({
            type: 'done',
            finishReason: 'tool_use',
        });

        const secondMessages = [
            {
                role: 'user' as const,
                content: [
                    {
                        type: 'text' as const,
                        text:
                            'What is the weather in Pune?',
                    },
                ],
            },
            {
                role: 'assistant' as const,
                content: [
                    {
                        type: 'tool_use' as const,
                        id: 'call_weather_1',
                        name: 'weather',
                        input: {
                            city: 'Pune',
                        },
                    },
                ],
            },
            {
                role: 'tool' as const,
                content: [
                    {
                        type: 'tool_result' as const,
                        toolUseId:
                            'call_weather_1',
                        content:
                            '{"city":"Pune","temperatureC":"28"}',
                        isError: false,
                    },
                ],
            },
        ];

        const secondEvents = [];

        for await (
            const event of provider.stream({
                model: 'openai-luna',
                messages: secondMessages,
                tools: [
                    {
                        name: 'weather',
                        description:
                            'Get the current weather for a city.',
                        parameters: {
                            type: 'object',
                            properties: {
                                city: {
                                    type: 'string',
                                },
                            },
                            required: ['city'],
                        },
                    },
                ],
            })
        ) {
            secondEvents.push(event);
        }

        expect(
            calls[1].input
        ).toContainEqual({
            type: 'function_call_output',
            call_id: 'call_weather_1',
            output:
                '{"city":"Pune","temperatureC":"28"}',
        });

        expect(
            secondEvents
        ).toContainEqual({
            type: 'text_delta',
            text:
                'The weather in Pune is partly cloudy.',
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