import { ensureTenant } from '../db/tenant-repository.js';
import { describe, expect, it, beforeEach } from 'vitest';
import { createDocument, addChunks, searchChunks } from './document-repository.js';
import db from '../db/database.js';

describe('RAG tenant isolation', () => {
    beforeEach(() => {
        db.prepare('DELETE FROM chunks').run();
        db.prepare('DELETE FROM documents').run();
    });
    it('does not return chunks belonging to another tenant', () => {
        const documentA = {
            id: crypto.randomUUID(),
            tenantId: 'tenant-a',
            filename: 'react-a.txt',
            embeddingProvider: 'test',
            embeddingModel: 'test-embedding-v1',
            createdAt: new Date().toISOString(),
        };

        const documentB = {
            id: crypto.randomUUID(),
            tenantId: 'tenant-b',
            filename: 'react-b.txt',
            embeddingProvider: 'test',
            embeddingModel: 'test-embedding-v1',
            createdAt: new Date().toISOString(),
        };

        ensureTenant('tenant-a', 'Tenant A');
        ensureTenant('tenant-b', 'Tenant B');

        createDocument(documentA);
        createDocument(documentB);

        addChunks([
            {
                id: crypto.randomUUID(),
                tenantId: 'tenant-a',
                documentId: documentA.id,
                text: 'React cleanup functions',
                chunkIndex: 0,
                embedding: [1, 0, 0],
            },
            {
                id: crypto.randomUUID(),
                tenantId: 'tenant-b',
                documentId: documentB.id,
                text: 'React cleanup functions from another tenant',
                chunkIndex: 0,
                embedding: [1, 0, 0],
            },
        ]);

        const queryEmbedding = [1, 0, 0];

        const results = searchChunks(
            'tenant-a',
            queryEmbedding,
            3,
            'test',
            'test-embedding-v1'
        );

        expect(results).toHaveLength(1);
        expect(results[0]!.chunk.tenantId).toBe('tenant-a');
    });

    it('only searches documents using the same embedding provider and model', () => {
        const compatibleDocument = {
            id: crypto.randomUUID(),
            tenantId: 'tenant-a',
            filename: 'compatible.txt',
            embeddingProvider: 'test',
            embeddingModel: 'test-embedding-v1',
            createdAt: new Date().toISOString(),
        };

        const incompatibleDocument = {
            id: crypto.randomUUID(),
            tenantId: 'tenant-a',
            filename: 'incompatible.txt',
            embeddingProvider: 'openai',
            embeddingModel: 'text-embedding-3-small',
            createdAt: new Date().toISOString(),
        };

        ensureTenant('tenant-a', 'Tenant A');

        createDocument(compatibleDocument);
        createDocument(incompatibleDocument);

        addChunks([
            {
                id: crypto.randomUUID(),
                tenantId: 'tenant-a',
                documentId: compatibleDocument.id,
                text: 'Compatible document',
                chunkIndex: 0,
                embedding: [1, 0],
            },
            {
                id: crypto.randomUUID(),
                tenantId: 'tenant-a',
                documentId: incompatibleDocument.id,
                text: 'Incompatible document',
                chunkIndex: 0,
                embedding: [1, 0],
            },
        ]);

        const results = searchChunks(
            'tenant-a',
            [1, 0],
            3,
            'test',
            'test-embedding-v1'
        );

        expect(results).toHaveLength(1);
        expect(results[0]!.chunk.filename).toBe(
            'compatible.txt'
        );
    });
});