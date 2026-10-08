import type { Request, Response } from 'express';
import { providerRegistry } from '../providers/index.js';
import type { Message } from '../providers/types.js';
import { getModelConfig } from '../config/models.js';
import { embeddingRegistry } from '../rag/index.js';
import { retrieveRelevantChunks } from '../rag/retrieval-service.js';
import {
    getToolDefinitions,
} from '../tools/definitions.js';
import {
    runStreamingToolLoop,
} from '../tools/tool-loop.js';

import {
    addMessage,
    createConversation,
    getConversation,
    getMessages,
    recordUsage,
} from '../db/conversation-repository.js';
import { getTenant } from '../db/tenant-repository.js';

interface ChatRequest {
    tenantId: string;
    conversationId?: string;
    provider: string;
    model: string;
    message: string;
    useRag?: boolean;
    topK?: number;
    embeddingProvider?: string;
}

export async function chatRoute(
    req: Request,
    res: Response
): Promise<void> {
    const body = req.body as Partial<ChatRequest>;

    if (
        typeof body.tenantId !== 'string' ||
        typeof body.provider !== 'string' ||
        typeof body.model !== 'string' ||
        typeof body.message !== 'string'
    ) {
        res.status(400).json({
            error: 'Invalid chat request',
        });

        return;
    }

    if (
        body.topK !== undefined &&
        (
            typeof body.topK !== 'number' ||
            !Number.isInteger(body.topK) ||
            body.topK < 1 ||
            body.topK > 10
        )
    ) {
        res.status(400).json({
            error: 'topK must be an integer between 1 and 10',
        });

        return;
    }

    const tenant = getTenant(body.tenantId);

    if (!tenant) {
        res.status(400).json({
            error: 'Tenant does not exist',
        });

        return;
    }

    let conversationId = body.conversationId;

    if (conversationId) {
        const conversation = getConversation(
            body.tenantId,
            conversationId
        );

        if (!conversation) {
            res.status(404).json({
                error: 'Conversation not found',
            });

            return;
        }
    } else {
        const conversation = createConversation(
            body.tenantId,
            body.message.slice(0, 50)
        );

        conversationId = conversation.id;
    }

    const modelConfig = getModelConfig(body.model);

    if (modelConfig.provider !== body.provider) {
        res.status(400).json({
            error: 'Model does not belong to the selected provider',
        });

        return;
    }

    const provider = providerRegistry.get(body.provider);

    let retrievedContext = '';

    let relevantChunks: Awaited<
        ReturnType<typeof retrieveRelevantChunks>
    > = [];

    if (body.useRag) {
        const embeddingProvider =
            embeddingRegistry.get(
                body.embeddingProvider ?? 'test'
            );

        relevantChunks = await retrieveRelevantChunks(
            body.tenantId,
            body.message,
            embeddingProvider,
            body.topK ?? 3
        );

        retrievedContext = relevantChunks
            .map((result, index) => {
                return `[Source ${index + 1}]
                Filename: ${result.chunk.filename}
                ${result.chunk.text}`;
            })
            .join('\n\n');
    }

    addMessage(
        conversationId,
        'user',
        body.message,
        body.provider,
        body.model
    );

    const storedMessages = getMessages(
        body.tenantId,
        conversationId
    );

    const messages: Message[] = storedMessages.map(
        (storedMessage) => ({
            role:
                storedMessage.role === 'assistant'
                    ? 'assistant'
                    : 'user',
            content: [
                {
                    type: 'text',
                    text: storedMessage.content,
                },
            ],
        })
    );

    const reservedOutputTokens = 4096;

    const estimatedTokens = Math.ceil(
        messages.reduce((total, message) => {
            return (
                total +
                message.content.reduce(
                    (contentTotal, block) =>
                        contentTotal + (block.text?.length ?? 0),
                    0
                )
            );
        }, 0) / 4
    );

    if (
        estimatedTokens + reservedOutputTokens >
        modelConfig.contextWindow
    ) {
        res.status(400).json({
            error: {
                kind: 'context_length',
                message: 'Conversation exceeds the model context window',
            },
        });

        return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    res.write(
        `data: ${JSON.stringify({
            type: 'conversation_start',
            conversationId,
        })}\n\n`
    );

    if (body.useRag) {
        for (const [index, result] of relevantChunks.entries()) {
            res.write(
                `data: ${JSON.stringify({
                    type: 'citation',
                    citation: {
                        sourceIndex: index + 1,
                        filename: result.chunk.filename,
                        documentId: result.chunk.documentId,
                        chunkId: result.chunk.id,
                        chunkIndex: result.chunk.chunkIndex,
                        score: result.score,
                    },
                })}\n\n`
            );
        }
    }

    const controller = new AbortController();

    res.on('close', () => {
        controller.abort();
    });

    console.log(
        `Starting stream with provider=${body.provider}, model=${body.model}`
    );

    let assistantText = '';

    const requestStartedAt = Date.now();
    let firstTokenAt: number | null = null;
    let inputTokens = 0;
    let outputTokens = 0;
    let finishReason: string | null = null;


    try {
        const ragSystemPrompt = body.useRag
            ? `
            Answer the user's question using the provided document context.

            If the context does not contain enough information to answer,
            say that you don't know based on the available documents.

            Document context:

            ${retrievedContext}
            `
            : undefined;

        const streamRequest = {
            model: body.model,
            signal: controller.signal,
            messages,
            tools: getToolDefinitions(),
            ...(ragSystemPrompt
                ? { system: ragSystemPrompt }
                : {}),
        };

        const stream =
            runStreamingToolLoop(
                provider,
                streamRequest,
                { 
                    tenantId: body.tenantId,
                }
            );

        for await (const event of stream) {
            console.log('Stream event:', event);

            if (event.type === 'text_delta') {
                assistantText += event.text;

                if (firstTokenAt === null) {
                    firstTokenAt = Date.now();
                }
            }

            if (event.type === 'usage') {
                inputTokens = event.usage.inputTokens;
                outputTokens = event.usage.outputTokens;
            }

            if (event.type === 'done') {
                finishReason = event.finishReason;
            }

            if (event.type === 'error') {
                res.write(
                    `data: ${JSON.stringify({
                        type: 'error',
                        error: {
                            kind: event.error.kind,
                            provider: event.error.provider,
                            retryable: event.error.retryable,
                            retryAfterMs: event.error.retryAfterMs,
                        },
                    })}\n\n`
                );

                res.end();

                return;
            }

            res.write(`data: ${JSON.stringify(event)}\n\n`);
        }
    } catch (error) {
        console.error('Provider stream error:', error);

        const providerError = error as {
            kind?: string;
            provider?: string;
            retryable?: boolean;
            retryAfterMs?: number;
        };

        res.write(
            `data: ${JSON.stringify({
                type: 'error',
                error: {
                    kind: providerError.kind ?? 'server_error',
                    provider: providerError.provider ?? body.provider,
                    retryable: providerError.retryable ?? false,
                    retryAfterMs: providerError.retryAfterMs,
                },
            })}\n\n`
        );

        res.end();

        return;
    }
    const latencyMs = Date.now() - requestStartedAt;

    const ttftMs =
        firstTokenAt === null
            ? null
            : firstTokenAt - requestStartedAt;

    const costUsd =
        (inputTokens / 1_000_000) *
        modelConfig.pricing.inputPerMTok +
        (outputTokens / 1_000_000) *
        modelConfig.pricing.outputPerMTok;

    if (assistantText) {
        addMessage(
            conversationId,
            'assistant',
            assistantText,
            body.provider,
            body.model
        );
    }

    recordUsage({
        tenantId: body.tenantId,
        conversationId,
        provider: body.provider,
        model: body.model,
        inputTokens,
        outputTokens,
        costUsd,
        ttftMs,
        latencyMs,
        finishReason,
        retryCount: 0,
        fallbackUsed: false,
    });

    res.end();
}