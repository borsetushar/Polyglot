export interface ModelConfig {
    provider: string;
    providerModelId: string;
    contextWindow: number;

    capabilities: {
        tools: boolean;
        vision: boolean;
        jsonSchema: boolean;
        streaming: boolean;
    };

    pricing: {
        inputPerMTok: number;
        outputPerMTok: number;
        cachedInputPerMTok?: number;
    };
}

export const models: Record<string, ModelConfig> = {
    'anthropic-sonnet': {
        provider: 'anthropic',
        providerModelId: 'claude-sonnet-5',
        contextWindow: 1000000,

        capabilities: {
            tools: true,
            vision: true,
            jsonSchema: true,
            streaming: true,
        },

        pricing: {
            inputPerMTok: 3,
            outputPerMTok: 15,
        },
    },

    'gemini-flash': {
        provider: 'gemini',
        providerModelId: 'gemini-3.6-flash',
        contextWindow: 1048576,

        capabilities: {
            tools: true,
            vision: true,
            jsonSchema: true,
            streaming: true,
        },

        pricing: {
            inputPerMTok: 0,
            outputPerMTok: 0,
        },
    },

    'openai-luna': {
        provider: 'openai',
        providerModelId: 'gpt-5.6-luna',
        contextWindow: 1050000,

        capabilities: {
            tools: true,
            vision: true,
            jsonSchema: true,
            streaming: true,
        },

        pricing: {
            inputPerMTok: 0.2,
            outputPerMTok: 1.2,
        },
    },
};

export function getModelConfig(modelId: string): ModelConfig {
    const config = models[modelId];

    if (!config) {
        throw new Error(`Unknown model "${modelId}"`);
    }

    return config;
}