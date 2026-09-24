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
        return {
            content: [
                {
                    type: 'text',
                    text: `Received: ${req.messages[0]?.content[0]?.text ?? ''}`,
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
        const text =
            req.messages[0]?.content[0]?.text ?? '';

        const response = `Received: ${text}`;

        const words = response.split(' ');

        for (const [index, word] of words.entries()) {
            if (req.signal?.aborted) {
                return;
            }

            yield {
                type: 'text_delta',
                text: index === 0 ? word : ` ${word}`,
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