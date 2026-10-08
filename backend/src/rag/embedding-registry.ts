import type { EmbeddingProvider } from './embedding-provider.js';

export class EmbeddingRegistry {
    private providers =
        new Map<string, EmbeddingProvider>();

    register(provider: EmbeddingProvider): void {
        this.providers.set(
            provider.name,
            provider
        );
    }

    get(name: string): EmbeddingProvider {
        const provider =
            this.providers.get(name);

        if (!provider) {
            throw new Error(
                `Embedding provider "${name}" is not registered`
            );
        }

        return provider;
    }
}