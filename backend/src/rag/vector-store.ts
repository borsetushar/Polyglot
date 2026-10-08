import type { DocumentChunk } from './types.js';

export interface StoredChunk extends DocumentChunk {
    embedding: number[];
}

export interface RetrievedChunk extends StoredChunk {
    filename: string;
}

export interface VectorSearchResult {
    chunk: RetrievedChunk;
    score: number;
}

export interface VectorStore {
    add(chunks: StoredChunk[]): Promise<void>;

    search(
        tenantId: string,
        queryEmbedding: number[],
        topK: number
    ): Promise<VectorSearchResult[]>;
}