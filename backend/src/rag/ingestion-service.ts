import { chunkText } from './chunker.js';
import { createDocument, addChunks } from './document-repository.js';
import type { StoredChunk } from './vector-store.js';
import type { EmbeddingProvider } from './embedding-provider.js';

export interface IngestDocumentInput {
    tenantId: string;
    filename: string;
    text: string;
}

export async function ingestDocument(
    input: IngestDocumentInput,
    embeddingProvider: EmbeddingProvider
): Promise<void> {
    const {
        tenantId,
        filename,
        text,
    } = input;

    console.log('Ingesting document:', {
        tenantId,
        filename,
        textLength: text.length,
    });
    const documentId = crypto.randomUUID();

    createDocument({
        id: documentId,
        tenantId,
        filename,
        embeddingProvider: embeddingProvider.name,
        embeddingModel: embeddingProvider.model,
        createdAt: new Date().toISOString(),
    });

    const chunks = chunkText(text, {
        chunkSize: 100,
        overlap: 20,
    });

    const embeddings = await embeddingProvider.embed(chunks);
    console.log('Created embeddings:', embeddings.length);

    if (embeddings.length !== chunks.length) {
        throw new Error('Embedding count does not match chunk count');
    }

    const storedChunks = chunks.map((chunk, index) => {
        const embedding = embeddings[index];

        if (!embedding) {
            throw new Error(`Missing embedding for chunk ${index}`);
        }

        return {
            id: crypto.randomUUID(),
            tenantId,
            documentId,
            chunkIndex: index,
            text: chunk,
            embedding,
        };
    });

    addChunks(storedChunks);
    console.log('Created chunks:', chunks.length);
}