import {
  GoogleGenAI,
  type Content,
  type Part,
  type Tool,
} from '@google/genai';

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

  private buildTools(req: CompletionRequest): Tool[] {
  if (!req.tools?.length) {
    return [];
  }

  return [
    {
      functionDeclarations: req.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      })),
    },
  ];
}

  private buildContents(
    req: CompletionRequest
  ): Content[] {
    return req.messages.map((message): Content => {
      if (message.role === 'tool') {
        const parts: Part[] = message.content
          .filter(
            (block) => block.type === 'tool_result'
          )
          .map((block) => ({
            functionResponse: {
              name: block.name ?? '',
              response: {
                result: block.content ?? '',
              },
              ...(block.toolUseId
                ? { id: block.toolUseId }
                : {}),
            },
          }));

        return {
          role: 'user',
          parts,
        };
      }

      const parts: Part[] = message.content.flatMap(
        (block): Part[] => {
          if (block.type === 'text') {
            return [
              {
                text: block.text ?? '',
              },
            ];
          }

          if (block.type === 'tool_use') {
            return [
              {
                functionCall: {
                  name: block.name ?? '',
                  args: block.input ?? {},
                  ...(block.id
                    ? { id: block.id }
                    : {}),
                },
              },
            ];
          }

          return [];
        }
      );

      return {
        role:
          message.role === 'assistant'
            ? 'model'
            : 'user',
        parts,
      };
    });
  }

  async complete(
    req: CompletionRequest
  ): Promise<CompletionResponse> {
    try {
      const config = getModelConfig(req.model);

      const response =
        await this.client.models.generateContent({
          model: config.providerModelId,
          contents: this.buildContents(req),
          config: {
            ...(req.system !== undefined && {
              systemInstruction: req.system,
            }),
            ...(req.temperature !== undefined && {
              temperature: req.temperature,
            }),
            maxOutputTokens: req.maxTokens ?? 1024,
            tools: this.buildTools(req),
          },
        });

      const content: ContentBlock[] = [];

      for (const call of response.functionCalls ?? []) {
        content.push({
          type: 'tool_use',
          id: call.id ?? crypto.randomUUID(),
          name: call.name ?? '',
          input:
            (call.args as Record<string, unknown>) ??
            {},
        });
      }

      if (response.text) {
        content.push({
          type: 'text',
          text: response.text,
        });
      }

      const usageMetadata =
        response.usageMetadata;

      const usage: Usage = {
        inputTokens:
          usageMetadata?.promptTokenCount ?? 0,
        outputTokens:
          usageMetadata?.candidatesTokenCount ?? 0,
      };

      return {
        content,
        usage,
        finishReason:
          content.some(
            (block) => block.type === 'tool_use'
          )
            ? 'tool_use'
            : 'stop',
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

      const stream =
        await this.client.models.generateContentStream({
          model: config.providerModelId,
          contents: this.buildContents(req),
          config: {
            ...(req.system !== undefined && {
              systemInstruction: req.system,
            }),
            ...(req.temperature !== undefined && {
              temperature: req.temperature,
            }),
            maxOutputTokens:
              req.maxTokens ?? 1024,
            ...(this.buildTools(req) && {
              tools: this.buildTools(req),
            }),
          },
        });

      let hasToolCall = false;

      for await (const chunk of stream) {
        if (req.signal?.aborted) {
          return;
        }

        const functionCalls =
          chunk.functionCalls ?? [];

        for (const call of functionCalls) {
          hasToolCall = true;

          const id =
            call.id ?? crypto.randomUUID();

          yield {
            type: 'tool_use_start',
            id,
            name: call.name ?? '',
          };

          yield {
            type: 'tool_use_complete',
            id,
            name: call.name ?? '',
            input:
              (call.args as Record<string, unknown>) ??
              {},
          };
        }

        const text = chunk.text;

        if (text) {
          yield {
            type: 'text_delta',
            text,
          };
        }

        const usageMetadata =
          chunk.usageMetadata;

        if (usageMetadata) {
          yield {
            type: 'usage',
            usage: {
              inputTokens:
                usageMetadata.promptTokenCount ?? 0,
              outputTokens:
                usageMetadata.candidatesTokenCount ?? 0,
            },
          };
        }
      }

      yield {
        type: 'done',
        finishReason:
          hasToolCall
            ? 'tool_use'
            : 'stop',
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