import { ProviderRegistry } from './registry.js';
import { TestProvider } from './test-provider.js';
import { GeminiProvider } from './gemini.js';
import { OpenAIProvider } from './openai.js';

export const providerRegistry = new ProviderRegistry();

providerRegistry.register(new TestProvider());

const geminiApiKey = process.env.GEMINI_API_KEY;

if (geminiApiKey) {
    providerRegistry.register(
        new GeminiProvider(geminiApiKey)
    );
}

const openaiApiKey = process.env.OPENAI_API_KEY;

if (openaiApiKey) {
    providerRegistry.register(
        new OpenAIProvider(openaiApiKey)
    );
}