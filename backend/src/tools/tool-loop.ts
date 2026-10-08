import type {
    CompletionRequest,
    ContentBlock,
    Provider,
    Message,
    StreamEvent,
    FinishReason,
} from '../providers/types.js';

import {
    executeTool,
} from './executor.js';
import type {
    ToolExecutionContext,
} from './types.js';

export async function runToolLoop(
    provider: Provider,
    request: CompletionRequest,
    context: ToolExecutionContext,
    maxIterations: number = 5
) {
    const messages: Message[] = [
        ...request.messages,
    ];

    for (
        let iteration = 0;
        iteration < maxIterations;
        iteration++
    ) {
        const response =
            await provider.complete({
                ...request,
                messages,
            });

        const toolCalls =
            response.content.filter(
                (block) =>
                    block.type === 'tool_use'
            );

        if (toolCalls.length === 0) {
            return response;
        }

        messages.push({
            role: 'assistant',
            content: response.content,
        });

        const toolResults: ContentBlock[] = [];

        for (const toolCall of toolCalls) {
            if (
                !toolCall.id ||
                !toolCall.name
            ) {
                continue;
            }

            const result =
                await executeTool(
                    toolCall.name,
                    toolCall.input ?? {},
                    context
                );

            toolResults.push({
                type: 'tool_result',
                toolUseId: toolCall.id,
                content: result.content,
                isError: result.isError,
            });
        }

        messages.push({
            role: 'tool',
            content: toolResults,
        });
    }

    throw new Error(
        'Tool calling exceeded maximum iterations'
    );
}

export async function* runStreamingToolLoop(
    provider: Provider,
    request: CompletionRequest,
    context: ToolExecutionContext,
    maxIterations: number = 5
): AsyncGenerator<StreamEvent> {
    const messages: Message[] = [
        ...request.messages,
    ];

    for (
        let iteration = 0;
        iteration < maxIterations;
        iteration++
    ) {
        let toolCalls: ContentBlock[] = [];
        let finishReason: FinishReason = 'stop';

        for await (
            const event of provider.stream({
                ...request,
                messages,
            })
        ) {
            if (event.type === 'tool_use_complete') {
                toolCalls.push({
                    type: 'tool_use',
                    id: event.id,
                    name: event.name,
                    input: event.input,
                });
            }

            if (event.type === 'done') {
                finishReason = event.finishReason;

                // `tool_use` means this provider iteration is finished,
                // not that the overall chat request is finished.
                if (event.finishReason === 'tool_use') {
                    continue;
                }
            }

            yield event;
        }

        if (toolCalls.length === 0) {
            return;
        }

        messages.push({
            role: 'assistant',
            content: toolCalls,
        });

        const toolResults: ContentBlock[] = [];

        for (const toolCall of toolCalls) {
            if (
                !toolCall.id ||
                !toolCall.name
            ) {
                continue;
            }

            const result =
                await executeTool(
                    toolCall.name,
                    toolCall.input ?? {},
                    context
                );

            toolResults.push({
                type: 'tool_result',
                toolUseId: toolCall.id,
                content: result.content,
                isError: result.isError,
            });
        }

        messages.push({
            role: 'tool',
            content: toolResults,
        });

        if (finishReason !== 'tool_use') {
            return;
        }
    }

    throw new Error(
        'Tool calling exceeded maximum iterations'
    );
}