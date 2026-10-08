import { describe, expect, it } from 'vitest';
import { TestEmbeddingProvider } from './test-embedding-provider.js';

describe('TestEmbeddingProvider', () => {
    it('creates one vector for each input text', async () => {
        const provider = new TestEmbeddingProvider();

        const result = await provider.embed([
            'Hello world',
            'React is awesome',
        ]);

        expect(result).toHaveLength(2);
        expect(result[0]).toHaveLength(3);
        expect(result[1]).toHaveLength(3);
    });

    it('produces deterministic vectors', async () => {
        const provider = new TestEmbeddingProvider();

        const first = await provider.embed(['Hello world']);
        const second = await provider.embed(['Hello world']);

        expect(first).toEqual(second);
    });
});