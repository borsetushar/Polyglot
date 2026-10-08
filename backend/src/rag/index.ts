import OpenAI from 'openai';

import { EmbeddingRegistry } from './embedding-registry.js';
import { TestEmbeddingProvider } from './test-embedding-provider.js';
import { OpenAIEmbeddingProvider } from './openai-embedding-provider.js';

export const embeddingRegistry =
    new EmbeddingRegistry();

embeddingRegistry.register(
    new TestEmbeddingProvider()
);

const openaiApiKey = process.env.OPENAI_API_KEY;

if (openaiApiKey) {
    const openaiClient = new OpenAI({
        apiKey: openaiApiKey,
    });

    embeddingRegistry.register(
        new OpenAIEmbeddingProvider(
            openaiClient,
            'text-embedding-3-small'
        )
    );
}