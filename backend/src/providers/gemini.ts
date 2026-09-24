import { GoogleGenAI } from '@google/genai';

import { getModelConfig } from '../config/models.js';
import { createProviderError } from '../utils/errors.js';

import type {
  CompletionRequest,
  CompletionResponse,
  ContentBlock,
  Provider,
  StreamEvent,
  Usage,
} from './types.js';

export class GeminiProvider implements Provider {
  readonly name = 'gemini';

  private client: GoogleGenAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({
      apiKey,
    });
  }

  async complete(
    req: CompletionRequest
  ): Promise<CompletionResponse> {
    try {
      const config = getModelConfig(req.model);

      const contents = req.messages
        .filter((message) => message.role !== 'tool')
        .map((message) => ({
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: message.content
            .filter((block) => block.type === 'text')
            .map((block) => ({
              text: block.text ?? '',
            })),
        }));

      const response = await this.client.models.generateContent({
        model: config.providerModelId,
        contents,
        config: {
          ...(req.system !== undefined && {
            systemInstruction: req.system,
          }),
          ...(req.temperature !== undefined && {
            temperature: req.temperature,
          }),
          maxOutputTokens: req.maxTokens ?? 1024,
        },
      });

      const text = response.text ?? '';

      const content: ContentBlock[] = [
        {
          type: 'text',
          text,
        },
      ];

      const usageMetadata = response.usageMetadata;

      const usage: Usage = {
        inputTokens: usageMetadata?.promptTokenCount ?? 0,
        outputTokens: usageMetadata?.candidatesTokenCount ?? 0,
      };

      return {
        content,
        usage,
        finishReason: 'stop',
      };
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  async *stream(
    req: CompletionRequest
  ): AsyncIterable<StreamEvent> {
    try {
      const config = getModelConfig(req.model);

      const contents = req.messages
        .filter((message) => message.role !== 'tool')
        .map((message) => ({
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: message.content
            .filter((block) => block.type === 'text')
            .map((block) => ({
              text: block.text ?? '',
            })),
        }));

      const stream = await this.client.models.generateContentStream({
        model: config.providerModelId,
        contents,
        config: {
          ...(req.system !== undefined && {
            systemInstruction: req.system,
          }),
          ...(req.temperature !== undefined && {
            temperature: req.temperature,
          }),
          maxOutputTokens: req.maxTokens ?? 1024,
        },
      });

      for await (const chunk of stream) {
        if (req.signal?.aborted) {
          return;
        }

        const text = chunk.text;

        if (text) {
          yield {
            type: 'text_delta',
            text,
          };
        }

        const usageMetadata = chunk.usageMetadata;

        if (usageMetadata) {
          yield {
            type: 'usage',
            usage: {
              inputTokens: usageMetadata.promptTokenCount ?? 0,
              outputTokens: usageMetadata.candidatesTokenCount ?? 0,
            },
          };
        }
      }

      yield {
        type: 'done',
        finishReason: 'stop',
      };
    } catch (error) {
      yield {
        type: 'error',
        error: this.normalizeError(error),
      };
    }
  }

  async embed(): Promise<number[][]> {
    throw new Error(
      'Gemini embeddings will be implemented with the embedding abstraction'
    );
  }

  private normalizeError(error: unknown) {
    return createProviderError(
      'server_error',
      this.name,
      'Gemini provider request failed',
      true,
      error
    );
  }
}