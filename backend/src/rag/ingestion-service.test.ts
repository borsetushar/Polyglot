import { describe, expect, it } from 'vitest';
import { ingestDocument } from './ingestion-service.js';
import { TestEmbeddingProvider } from './test-embedding-provider.js';
import { ensureTenant } from '../db/tenant-repository.js';

describe('ingestDocument', () => {
    it('accepts document information', async () => {
        ensureTenant(
            'tenant-a',
            'Tenant A'
        );
        const embeddingProvider = new TestEmbeddingProvider();

        await expect(
            ingestDocument(
                {
                    tenantId: 'tenant-a',
                    filename: 'react.txt',
                    text: 'React is a JavaScript library.',
                },
                embeddingProvider
            )
        ).resolves.toBeUndefined();
    });
});