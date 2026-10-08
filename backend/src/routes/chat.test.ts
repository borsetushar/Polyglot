import { describe, expect, it } from 'vitest';
import { providerRegistry } from '../providers/index.js';

import express from 'express';
import request from 'supertest';

import { ensureTenant } from '../db/tenant-repository.js';
import { ingestDocument } from '../rag/ingestion-service.js';
import { TestEmbeddingProvider } from '../rag/test-embedding-provider.js';
import { chatRoute } from './chat.js';
import type {
    CompletionRequest,
    CompletionResponse,
    Provider,
    StreamEvent,
} from '../providers/types.js';


class CaptureProvider implements Provider {
    readonly name = 'capture';

    lastRequest: CompletionRequest | null = null;

    async complete(
        req: CompletionRequest
    ): Promise<CompletionResponse> {
        throw new Error('Not used in this test');
    }

    async *stream(
        req: CompletionRequest
    ): AsyncIterable<StreamEvent> {
        this.lastRequest = req;

        yield {
            type: 'text_delta',
            text: 'Test response',
        };

        yield {
            type: 'usage',
            usage: {
                inputTokens: 10,
                outputTokens: 2,
            },
        };

        yield {
            type: 'done',
            finishReason: 'stop',
        };
    }
}

describe('chatRoute RAG integration', () => {
    it('passes retrieved document context to the provider', async () => {
        const tenantId = `chat-rag-test-${crypto.randomUUID()}`;

        ensureTenant(
            tenantId,
            'Chat RAG Test Tenant'
        );

        const embeddingProvider =
            new TestEmbeddingProvider();

        await ingestDocument(
            {
                tenantId,
                filename: 'react.txt',
                text: 'React is a JavaScript library for building user interfaces.',
            },
            embeddingProvider
        );

        const captureProvider =
            new CaptureProvider();

        providerRegistry.register(
            captureProvider
        );

        const app = express();

        app.use(express.json());

        app.post('/api/chat', chatRoute);

        const response = await request(app)
            .post('/api/chat')
            .send({
                tenantId,
                provider: 'capture',
                model: 'capture-model',
                message: 'What is React?',
                useRag: true,
                embeddingProvider: 'test',
            });
            
        expect(response.status).toBe(200);

        expect(response.text).toContain(
            'Test response'
        );

        expect(response.text).toContain(
            '"type":"citation"'
        );

        expect(response.text).toContain(
            '"filename":"react.txt"'
        );

        expect(captureProvider.lastRequest)
            .not.toBeNull();

        expect(captureProvider.lastRequest?.system)
            .toContain(
                'React is a JavaScript library'
            );
    });
});


const captureProvider = new CaptureProvider();

providerRegistry.register(captureProvider);

it('rejects an invalid topK value', async () => {
    const tenantId = `topk-test-${crypto.randomUUID()}`;

    ensureTenant(
        tenantId,
        'TopK Test Tenant'
    );

    const app = express();

    app.use(express.json());

    app.post('/api/chat', chatRoute);

    const response = await request(app)
        .post('/api/chat')
        .send({
            tenantId,
            provider: 'capture',
            model: 'capture-model',
            message: 'What is React?',
            useRag: true,
            topK: 0,
        })
        .expect(400);

    expect(response.body.error)
        .toBe('topK must be an integer between 1 and 10');
});

it('uses the requested topK for RAG citations', async () => {
    const tenantId = `topk-rag-test-${crypto.randomUUID()}`;

    ensureTenant(
        tenantId,
        'TopK RAG Test Tenant'
    );

    const embeddingProvider =
        new TestEmbeddingProvider();

    await ingestDocument(
        {
            tenantId,
            filename: 'react.txt',
            text:
                'React is a JavaScript library. ' +
                'Components are reusable UI pieces. ' +
                'Props allow data to be passed between components.',
        },
        embeddingProvider
    );

    const captureProvider =
        new CaptureProvider();

    providerRegistry.register(
        captureProvider
    );

    const app = express();

    app.use(express.json());

    app.post('/api/chat', chatRoute);

    const response = await request(app)
        .post('/api/chat')
        .send({
            tenantId,
            provider: 'capture',
            model: 'capture-model',
            message: 'What is React?',
            useRag: true,
            topK: 1,
        })
        .expect(200);

    const citationEvents = response.text
        .split('\n')
        .filter((line) =>
            line.includes('"type":"citation"')
        );

    expect(citationEvents)
        .toHaveLength(1);
});