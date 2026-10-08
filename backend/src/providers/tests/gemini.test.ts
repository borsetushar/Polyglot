import { describe, expect, it, vi } from 'vitest';

import { GeminiProvider } from '../gemini.js';

describe('GeminiProvider', () => {
  it('normalizes a Gemini function call', async () => {
    const provider = new GeminiProvider(
      'test-api-key'
    );

    vi.spyOn(
      (provider as any).client.models,
      'generateContent'
    ).mockResolvedValue({
      functionCalls: [
        {
          id: 'call_weather_1',
          name: 'weather',
          args: {
            city: 'Pune',
          },
        },
      ],
      text: '',
      usageMetadata: {
        promptTokenCount: 20,
        candidatesTokenCount: 8,
      },
    });

    const response =
      await provider.complete({
        model: 'gemini-flash',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text:
                  'What is the weather in Pune?',
              },
            ],
          },
        ],
        tools: [
          {
            name: 'weather',
            description:
              'Get the current weather for a city.',
            parameters: {
              type: 'object',
              properties: {
                city: {
                  type: 'string',
                },
              },
              required: ['city'],
            },
          },
        ],
      });

    expect(response.finishReason).toBe(
      'tool_use'
    );

    expect(response.content).toContainEqual({
      type: 'tool_use',
      id: 'call_weather_1',
      name: 'weather',
      input: {
        city: 'Pune',
      },
    });

    expect(response.usage).toEqual({
      inputTokens: 20,
      outputTokens: 8,
    });
  });
});