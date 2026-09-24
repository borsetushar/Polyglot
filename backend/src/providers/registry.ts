import type { Provider } from './types.js';

export class ProviderRegistry {
  private providers = new Map<string, Provider>();

  register(provider: Provider): void {
    this.providers.set(provider.name, provider);
  }

  get(name: string): Provider {
    const provider = this.providers.get(name);

    if (!provider) {
      throw new Error(`Provider "${name}" is not registered`);
    }

    return provider;
  }
}