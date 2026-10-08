export interface DocumentChunk {
    id: string;
    tenantId: string;
    documentId: string;
    text: string;
    chunkIndex: number;
}