import { describe, expect, it } from 'vitest';

import db from '../db/database.js';
import { ensureTenant } from '../db/tenant-repository.js';
import { createDocument, addChunks } from './document-repository.js';
import { TestEmbeddingProvider } from './test-embedding-provider.js';
import { retrieveRelevantChunks } from './retrieval-service.js';

describe('retrieveRelevantChunks', () => {
    const tenantId = `retrieval-test-${crypto.randomUUID()}`;

    ensureTenant(tenantId, 'Retrieval Test Tenant');

    it('retrieves chunks for the requested tenant', async () => {
        const embeddingProvider = new TestEmbeddingProvider();

        const documentId = crypto.randomUUID();

        createDocument({
            id: documentId,
            tenantId,
            filename: 'react.txt',
            embeddingProvider: 'test',
            embeddingModel: 'test-embedding-v1',
            createdAt: new Date().toISOString(),
        });

        const chunks = [
            'React is a JavaScript library.',
            'Components are reusable UI pieces.',
        ];

        const embeddings =
            await embeddingProvider.embed(chunks);

        addChunks(
            chunks.map((text, index) => ({
                id: crypto.randomUUID(),
                tenantId: tenantId,
                documentId,
                chunkIndex: index,
                text,
                embedding: embeddings[index]!,
            }))
        );

        const results = await retrieveRelevantChunks(
            tenantId,
            'React is a JavaScript library.',
            embeddingProvider,
            2
        );

        expect(results).toHaveLength(2);
        expect(results[0]!.chunk.text)
            .toBe('React is a JavaScript library.');
        expect(results[0]!.chunk.filename)
            .toBe('react.txt');
    });
});