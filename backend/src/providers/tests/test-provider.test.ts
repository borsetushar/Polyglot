import { describe, expect, it } from 'vitest';

import { TestProvider } from '../test-provider.js';

describe('TestProvider', () => {
  it('completes a request', async () => {
    const provider = new TestProvider();

    const response = await provider.complete({
      model: 'test-model',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Hello Polyglot',
            },
          ],
        },
      ],
    });

    expect(response.finishReason).toBe('stop');
    expect(response.content[0]?.type).toBe('text');
    expect(response.content[0]?.text).toContain('Hello Polyglot');
  });

  it('streams text and finishes', async () => {
    const provider = new TestProvider();

    const events = [];

    for await (const event of provider.stream({
      model: 'test-model',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Hello',
            },
          ],
        },
      ],
    })) {
      events.push(event);
    }

    expect(events.some((event) => event.type === 'text_delta')).toBe(true);
    expect(events.some((event) => event.type === 'usage')).toBe(true);
    expect(events.some((event) => event.type === 'done')).toBe(true);
  });
});