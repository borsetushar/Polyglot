import {
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { TestProvider } from '../providers/test-provider.js';
import {
    runToolLoop,
    runStreamingToolLoop,
} from './tool-loop.js';
import { getToolDefinitions } from './definitions.js';
import db from '../db/database.js';
import { ingestDocument } from '../rag/ingestion-service.js';
import { TestEmbeddingProvider } from '../rag/test-embedding-provider.js';
import type {
    Provider,
    StreamEvent,
} from '../providers/types.js';
import { WeatherTool } from './weather.js';

describe('tool calling loop', () => {
    it('executes a calculator tool and returns the final response', async () => {
        const provider =
            new TestProvider();

        const response =
            await runToolLoop(
                provider,
                {
                    model: 'test-model',
                    messages: [
                        {
                            role: 'user',
                            content: [
                                {
                                    type: 'text',
                                    text:
                                        'What is 25 * 18?',
                                },
                            ],
                        },
                    ],
                    tools: getToolDefinitions(),
                },
                {
                    tenantId: 'tool-test-tenant',
                }
            );

        expect(
            response.finishReason
        ).toBe('stop');

        expect(
            response.content[0]?.text
        ).toContain('450');
    });
    it(
        'executes search_documents and returns the retrieved document content',
        async () => {
            db.exec(`
            DELETE FROM usage;
            DELETE FROM messages;
            DELETE FROM chunks;
            DELETE FROM documents;
            DELETE FROM conversations;
            DELETE FROM tenants;
        `);

            db.prepare(`
            INSERT INTO tenants (id, name)
            VALUES (?, ?)
        `).run(
                'tool-test-tenant',
                'Tool Test Tenant'
            );

            const embeddingProvider =
                new TestEmbeddingProvider();

            await ingestDocument(
                {
                    tenantId: 'tool-test-tenant',
                    filename: 'react.txt',
                    text:
                        'React components are reusable building blocks for user interfaces.',
                },
                embeddingProvider
            );

            const provider =
                new TestProvider();

            const response =
                await runToolLoop(
                    provider,
                    {
                        model: 'test-model',
                        messages: [
                            {
                                role: 'user',
                                content: [
                                    {
                                        type: 'text',
                                        text:
                                            'What are React components?',
                                    },
                                ],
                            },
                        ],
                        tools: getToolDefinitions(),
                    },
                    {
                        tenantId: 'tool-test-tenant',
                    }
                );

            expect(
                response.finishReason
            ).toBe('stop');

            expect(
                response.content[0]?.text
            ).toContain(
                'React components'
            );

            expect(
                response.content[0]?.text
            ).toContain(
                'reusable building blocks'
            );
        }
    );
    it(
        'streams a search tool call and then streams the final answer',
        async () => {
            const provider =
                new TestProvider();

            const events: StreamEvent[] = [];

            for await (
                const event of runStreamingToolLoop(
                    provider,
                    {
                        model: 'test-model',
                        messages: [
                            {
                                role: 'user',
                                content: [
                                    {
                                        type: 'text',
                                        text:
                                            'What are React components?',
                                    },
                                ],
                            },
                        ],
                        tools: getToolDefinitions(),
                    },
                    {
                        tenantId: 'tool-test-tenant',
                    }
                )
            ) {
                events.push(event);
            }

            const toolEvent =
                events.find(
                    (event) =>
                        event.type ===
                        'tool_use_complete'
                );

            expect(toolEvent).toMatchObject({
                type: 'tool_use_complete',
                name: 'search_documents',
            });

            const text =
                events
                    .filter(
                        (event) =>
                            event.type ===
                            'text_delta'
                    )
                    .map(
                        (event) =>
                            event.text
                    )
                    .join('');

            expect(text).toContain(
                'React components'
            );

            expect(text).toContain(
                'reusable building blocks'
            );

            const doneEvent =
                events.find(
                    (event) =>
                        event.type === 'done' &&
                        event.finishReason === 'stop'
                );

            expect(doneEvent).toBeDefined();
        }
    );
    it('runs the weather tool loop', async () => {
        const provider = new TestProvider();
        const fetchMock = vi
            .spyOn(globalThis, 'fetch')
            .mockResolvedValue(
                new Response(
                    JSON.stringify({
                        current_condition: [
                            {
                                temp_C: '28',
                                FeelsLikeC: '29',
                                humidity: '72',
                                weatherDesc: [
                                    {
                                        value: 'Partly cloudy',
                                    },
                                ],
                            },
                        ],
                    }),
                    {
                        status: 200,
                        headers: {
                            'Content-Type':
                                'application/json',
                        },
                    }
                )
            );
        const response =
            await runToolLoop(
                provider,
                {
                    model: 'test-model',
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
                    tools: getToolDefinitions(),
                },
                {
                    tenantId: 'tool-test-tenant',
                }
            );

        expect(
            response.finishReason
        ).toBe('stop');

        const text =
            response.content
                .find(
                    (block) =>
                        block.type === 'text'
                )
                ?.text ?? '';

        expect(text).toContain('Pune');
        fetchMock.mockRestore();
    });
    it('handles a streaming tool call followed by a final response',
        async () => {
            let iteration = 0;

            const provider: Provider = {
                name: 'openai-test',

                async complete() {
                    throw new Error(
                        'complete() should not be called'
                    );
                },

                async *stream() {
                    iteration++;

                    if (iteration === 1) {
                        yield {
                            type: 'tool_use_start',
                            id: 'call_weather_1',
                            name: 'weather',
                        };

                        yield {
                            type: 'tool_use_delta',
                            id: 'call_weather_1',
                            partialJson:
                                '{"city":"Pune"}',
                        };

                        yield {
                            type: 'tool_use_complete',
                            id: 'call_weather_1',
                            name: 'weather',
                            input: {
                                city: 'Pune',
                            },
                        };

                        yield {
                            type: 'usage',
                            usage: {
                                inputTokens: 20,
                                outputTokens: 8,
                            },
                        };

                        yield {
                            type: 'done',
                            finishReason: 'tool_use',
                        };

                        return;
                    }

                    yield {
                        type: 'text_delta',
                        text:
                            'The weather in Pune is partly cloudy.',
                    };

                    yield {
                        type: 'usage',
                        usage: {
                            inputTokens: 30,
                            outputTokens: 10,
                        },
                    };

                    yield {
                        type: 'done',
                        finishReason: 'stop',
                    };
                },
            };

            const fetchMock = vi
                .spyOn(globalThis, 'fetch')
                .mockResolvedValue(
                    new Response(
                        JSON.stringify({
                            current_condition: [
                                {
                                    temp_C: '28',
                                    FeelsLikeC: '29',
                                    humidity: '72',
                                    weatherDesc: [
                                        {
                                            value: 'Partly cloudy',
                                        },
                                    ],
                                },
                            ],
                        }),
                        {
                            status: 200,
                            headers: {
                                'Content-Type':
                                    'application/json',
                            },
                        }
                    )
                );

            const events: StreamEvent[] = [];

            for await (
                const event of runStreamingToolLoop(
                    provider,
                    {
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
                        tools: getToolDefinitions(),
                    },
                    {
                        tenantId: 'tool-test-tenant',
                    }
                )
            ) {
                events.push(event);
            }

            expect(iteration).toBe(2);

            expect(
                events.some(
                    (event) =>
                        event.type ===
                        'tool_use_complete' &&
                        event.name === 'weather'
                )
            ).toBe(true);

            const text = events
                .filter(
                    (event) =>
                        event.type === 'text_delta'
                )
                .map(
                    (event) => event.text
                )
                .join('');

            expect(text).toContain(
                'weather in Pune'
            );

            const doneEvents = events.filter(
                (event) =>
                    event.type === 'done'
            );

            expect(doneEvents).toEqual([
                {
                    type: 'done',
                    finishReason: 'stop',
                },
            ]);

            fetchMock.mockRestore();
        }
    );
});

