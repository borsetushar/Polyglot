import type { EmbeddingProvider } from './embedding-provider.js';
import {
    searchChunks,
} from './document-repository.js';
import type {
    VectorSearchResult,
} from './vector-store.js';

export async function retrieveRelevantChunks(
    tenantId: string,
    query: string,
    embeddingProvider: EmbeddingProvider,
    topK: number = 3
): Promise<VectorSearchResult[]> {
    const [queryEmbedding] =
        await embeddingProvider.embed([query]);

    if (!queryEmbedding) {
        throw new Error('Failed to create query embedding');
    }

    return searchChunks(
        tenantId,
        queryEmbedding,
        topK,
        embeddingProvider.name,
        embeddingProvider.model
    );
}