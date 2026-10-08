import db from '../db/database.js';
import type { StoredChunk } from './vector-store.js';
import { cosineSimilarity } from './similarity.js';
import type { VectorSearchResult } from './vector-store.js';

export interface DocumentRecord {
    id: string;
    tenantId: string;
    filename: string;
    embeddingProvider: string;
    embeddingModel: string;
    createdAt: string;
}

export function createDocument(
    document: DocumentRecord
): void {
    db.prepare(`
        INSERT INTO documents (
            id,
            tenant_id,
            filename,
            embedding_provider,
            embedding_model,
            created_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(
        document.id,
        document.tenantId,
        document.filename,
        document.embeddingProvider,
        document.embeddingModel,
        document.createdAt
    );
}

export function addChunks(
    chunks: StoredChunk[]
): void {
    const statement = db.prepare(`
        INSERT INTO chunks (
            id,
            tenant_id,
            document_id,
            chunk_index,
            text,
            embedding
        )
        VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction(
        (items: StoredChunk[]) => {
            for (const chunk of items) {
                statement.run(
                    chunk.id,
                    chunk.tenantId,
                    chunk.documentId,
                    chunk.chunkIndex,
                    chunk.text,
                    JSON.stringify(chunk.embedding)
                );
            }
        }
    );

    insertMany(chunks);
}

export function searchChunks(
    tenantId: string,
    queryEmbedding: number[],
    topK: number,
    embeddingProvider: string,
    embeddingModel: string
): VectorSearchResult[] {
    const rows = db.prepare(`
    SELECT
        chunks.id,
        chunks.tenant_id,
        chunks.document_id,
        chunks.chunk_index,
        chunks.text,
        chunks.embedding,
        documents.filename
    FROM chunks
    JOIN documents
        ON documents.id = chunks.document_id
   WHERE chunks.tenant_id = ?
  AND documents.embedding_provider = ?
  AND documents.embedding_model = ?
`).all(
        tenantId,
        embeddingProvider,
        embeddingModel
    ) as Array<{
        id: string;
        tenant_id: string;
        document_id: string;
        chunk_index: number;
        text: string;
        embedding: string;
        filename: string;
    }>;

    const results = rows.map((row) => {
        const embedding = JSON.parse(row.embedding) as number[];

        const score = cosineSimilarity(
            queryEmbedding,
            embedding
        );

        return {
            chunk: {
                id: row.id,
                tenantId: row.tenant_id,
                documentId: row.document_id,
                chunkIndex: row.chunk_index,
                text: row.text,
                embedding,
                filename: row.filename,
            },
            score,
        };
    });

    return results
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);
}