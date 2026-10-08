import {
    beforeEach,
    describe,
    expect,
    it,
} from 'vitest';

import { SearchDocumentsTool } from './search-documents.js';
import db from '../db/database.js';
import { ingestDocument } from '../rag/ingestion-service.js';
import { TestEmbeddingProvider } from '../rag/test-embedding-provider.js';

describe('SearchDocumentsTool', () => {
    const tool = new SearchDocumentsTool();

    const embeddingProvider =
        new TestEmbeddingProvider();

    beforeEach(() => {
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
    });

    it('searches tenant documents', async () => {
        await ingestDocument(
            {
                tenantId: 'tool-test-tenant',
                filename: 'react.txt',
                text:
                    'React components are reusable building blocks for user interfaces.',
            },
            embeddingProvider
        );

        const result =
            await tool.execute(
                {
                    query: 'React components',
                    topK: 3,
                },
                {
                    tenantId: 'tool-test-tenant',
                }
            );

        expect(result).toContain(
            'React components'
        );

        expect(result).toContain(
            'react.txt'
        );
    });

    it('does not return another tenant documents', async () => {
        await db.prepare(`
            INSERT INTO tenants (id, name)
            VALUES (?, ?)
        `).run(
            'other-tenant',
            'Other Tenant'
        );

        await ingestDocument(
            {
                tenantId: 'other-tenant',
                filename: 'secret.txt',
                text:
                    'This is private information.',
            },
            embeddingProvider
        );

        const result =
            await tool.execute(
                {
                    query: 'private information',
                    topK: 3,
                }, {
                tenantId: 'tool-test-tenant',
            });

        expect(result).toContain(
            'No relevant documents were found.'
        );

        expect(result).not.toContain(
            'private information'
        );
    });
});