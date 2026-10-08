export interface EmbeddingProvider {
    readonly name: string;
    readonly model: string;

    embed(texts: string[]): Promise<number[][]>;
}