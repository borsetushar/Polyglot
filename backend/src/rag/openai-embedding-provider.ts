import OpenAI from 'openai';
import type { EmbeddingProvider } from './embedding-provider.js';

export class OpenAIEmbeddingProvider
    implements EmbeddingProvider {

    readonly name = 'openai';

    constructor(
        private readonly client: OpenAI,
        readonly model: string
    ) {}

    async embed(
        texts: string[]
    ): Promise<number[][]> {

        const response =
            await this.client.embeddings.create({
                model: this.model,
                input: texts,
            });

        return response.data
            .sort((a, b) => a.index - b.index)
            .map((item) => item.embedding);
    }
}