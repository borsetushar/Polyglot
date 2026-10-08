import type { EmbeddingProvider } from './embedding-provider.js';

export class TestEmbeddingProvider
    implements EmbeddingProvider {

    readonly name = 'test';
    readonly model = 'test-embedding-v1';

    async embed(texts: string[]): Promise<number[][]> {
        return texts.map((text) => {
            return [
                text.length,
                text.split(/\s+/).length,
                text.charCodeAt(0) || 0,
            ];
        });
    }
}