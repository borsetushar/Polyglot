import type {
    CompletionRequest,
    CompletionResponse,
    Provider,
    StreamEvent,
} from './types.js';

export class TestProvider implements Provider {
    readonly name = 'test';

    async complete(
        req: CompletionRequest
    ): Promise<CompletionResponse> {
        const lastMessage =
            req.messages[req.messages.length - 1];

        // If the previous message contains a tool result,
        // return the final answer.
        if (lastMessage?.role === 'tool') {
            const toolResult =
                lastMessage.content.find(
                    (block) =>
                        block.type === 'tool_result'
                );

            return {
                content: [
                    {
                        type: 'text',
                        text: `Tool result: ${toolResult?.content ?? ''
                            }`,
                    },
                ],
                usage: {
                    inputTokens: 10,
                    outputTokens: 8,
                },
                finishReason: 'stop',
            };
        }

        // Simulate an LLM requesting the calculator.
        const hasSearchTool =
            req.tools?.some(
                (tool) =>
                    tool.name === 'search_documents'
            ) ?? false;

        const hasCalculatorTool =
            req.tools?.some(
                (tool) =>
                    tool.name === 'calculator'
            ) ?? false;

        const hasWeatherTool =
            req.tools?.some(
                (tool) =>
                    tool.name === 'weather'
            ) ?? false;

        const userMessage =
            req.messages
                .filter(
                    (message) =>
                        message.role === 'user'
                )
                .at(-1)
                ?.content
                .find(
                    (block) =>
                        block.type === 'text'
                )
                ?.text
                ?.toLowerCase() ?? '';
        if (
            hasWeatherTool &&
            (
                userMessage.includes('weather') ||
                userMessage.includes('temperature')
            )
        ) {
            return {
                content: [
                    {
                        type: 'tool_use',
                        id: 'test-weather-call-1',
                        name: 'weather',
                        input: {
                            city: 'Pune',
                        },
                    },
                ],
                usage: {
                    inputTokens: 10,
                    outputTokens: 5,
                },
                finishReason: 'tool_use',
            };
        }

        if (
            hasCalculatorTool &&
            (
                userMessage.includes('calculate') ||
                /\d+\s*[+\-*/]\s*\d+/.test(
                    userMessage
                )
            )
        ) {
            return {
                content: [
                    {
                        type: 'tool_use',
                        id: 'test-tool-call-1',
                        name: 'calculator',
                        input: {
                            expression: '25 * 18',
                        },
                    },
                ],
                usage: {
                    inputTokens: 10,
                    outputTokens: 5,
                },
                finishReason: 'tool_use',
            };
        }

        if (
            hasSearchTool &&
            (
                userMessage.includes('document') ||
                userMessage.includes('react') ||
                userMessage.includes('component')
            )
        ) {
            return {
                content: [
                    {
                        type: 'tool_use',
                        id: 'test-search-call-1',
                        name: 'search_documents',
                        input: {
                            query: 'React components',
                            topK: 3,
                        },
                    },
                ],
                usage: {
                    inputTokens: 10,
                    outputTokens: 5,
                },
                finishReason: 'tool_use',
            };
        }
        return {
            content: [
                {
                    type: 'text',
                    text: `Received: ${req.messages[0]
                        ?.content[0]?.text ?? ''
                        }`,
                },
            ],
            usage: {
                inputTokens: 10,
                outputTokens: 5,
            },
            finishReason: 'stop',
        };
    }

    async *stream(
        req: CompletionRequest
    ): AsyncIterable<StreamEvent> {
        const lastMessage =
            req.messages[req.messages.length - 1];

        // If the previous message contains a tool result,
        // simulate the LLM generating its final answer.
        if (lastMessage?.role === 'tool') {
            const toolResult =
                lastMessage.content.find(
                    (block) =>
                        block.type === 'tool_result'
                );

            const response =
                `Based on the documents: ${toolResult?.content ?? ''}`;

            const words = response.split(' ');

            for (const [index, word] of words.entries()) {
                if (req.signal?.aborted) {
                    return;
                }

                yield {
                    type: 'text_delta',
                    text:
                        index === 0
                            ? word
                            : ` ${word}`,
                };
            }

            yield {
                type: 'usage',
                usage: {
                    inputTokens: 20,
                    outputTokens: words.length,
                },
            };

            yield {
                type: 'done',
                finishReason: 'stop',
            };

            return;
        }

        const hasSearchTool =
            req.tools?.some(
                (tool) =>
                    tool.name === 'search_documents'
            ) ?? false;

        const hasCalculatorTool =
            req.tools?.some(
                (tool) =>
                    tool.name === 'calculator'
            ) ?? false;

        const hasWeatherTool =
            req.tools?.some(
                (tool) =>
                    tool.name === 'weather'
            ) ?? false;

        const userMessage =
            req.messages
                .filter(
                    (message) =>
                        message.role === 'user'
                )
                .at(-1)
                ?.content
                .find(
                    (block) =>
                        block.type === 'text'
                )
                ?.text
                ?.toLowerCase() ?? '';

        // Simulate streaming search_documents tool call.
        if (
            hasSearchTool &&
            (
                userMessage.includes('document') ||
                userMessage.includes('react') ||
                userMessage.includes('component')
            )
        ) {
            yield {
                type: 'tool_use_start',
                id: 'test-search-call-1',
                name: 'search_documents',
            };

            yield {
                type: 'tool_use_complete',
                id: 'test-search-call-1',
                name: 'search_documents',
                input: {
                    query: 'React components',
                    topK: 3,
                },
            };

            yield {
                type: 'usage',
                usage: {
                    inputTokens: 10,
                    outputTokens: 5,
                },
            };

            yield {
                type: 'done',
                finishReason: 'tool_use',
            };

            return;
        }

        if (
            hasWeatherTool &&
            (
                userMessage.includes('weather') ||
                userMessage.includes('temperature')
            )
        ) {
            yield {
                type: 'tool_use_start',
                id: 'test-weather-call-1',
                name: 'weather',
            };

            yield {
                type: 'tool_use_complete',
                id: 'test-weather-call-1',
                name: 'weather',
                input: {
                    city: 'Pune',
                },
            };

            yield {
                type: 'usage',
                usage: {
                    inputTokens: 10,
                    outputTokens: 5,
                },
            };

            yield {
                type: 'done',
                finishReason: 'tool_use',
            };

            return;
        }
        // Simulate streaming calculator tool call.
        if (
            hasCalculatorTool &&
            (
                userMessage.includes('calculate') ||
                /\d+\s*[+\-*/]\s*\d+/.test(
                    userMessage
                )
            )
        ) {
            yield {
                type: 'tool_use_start',
                id: 'test-tool-call-1',
                name: 'calculator',
            };

            yield {
                type: 'tool_use_complete',
                id: 'test-tool-call-1',
                name: 'calculator',
                input: {
                    expression: '25 * 18',
                },
            };

            yield {
                type: 'usage',
                usage: {
                    inputTokens: 10,
                    outputTokens: 5,
                },
            };

            yield {
                type: 'done',
                finishReason: 'tool_use',
            };

            return;
        }

        // Normal streaming response.
        const text =
            req.messages[0]?.content[0]?.text ?? '';

        const response =
            `Received: ${text}`;

        const words = response.split(' ');

        for (const [index, word] of words.entries()) {
            if (req.signal?.aborted) {
                return;
            }

            yield {
                type: 'text_delta',
                text:
                    index === 0
                        ? word
                        : ` ${word}`,
            };
        }

        yield {
            type: 'usage',
            usage: {
                inputTokens: 10,
                outputTokens: words.length,
            },
        };

        yield {
            type: 'done',
            finishReason: 'stop',
        };
    }
}