import 'dotenv/config';
import express from 'express';

import { ProviderRegistry } from './providers/registry.js';
import { TestProvider } from './providers/test-provider.js';
import { GeminiProvider } from './providers/gemini.js';
import { OpenAIProvider } from './providers/openai.js';

const app = express();

const port: number = 3000;

const registry = new ProviderRegistry();

registry.register(new TestProvider());

const geminiApiKey = process.env.GEMINI_API_KEY;

if (geminiApiKey) {
    registry.register(new GeminiProvider(geminiApiKey));
}

const openaiApiKey = process.env.OPENAI_API_KEY;

if (openaiApiKey) {
    registry.register(new OpenAIProvider(openaiApiKey));
}

app.get('/', async (req, res) => {
    try {
        const provider = registry.get('test');

        const response = await provider.complete({
            model: 'test-model',
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: 'Hello Polyglot!',
                        },
                    ],
                },
            ],
        });

        res.json(response);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Request failed',
        });
    }
});

app.get('/stream', async (req, res) => {
    const controller = new AbortController();

    req.on('close', () => {
        controller.abort();
    });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
        const providerName = req.query.provider?.toString() ?? 'test';
        const model = req.query.model?.toString() ?? 'test-model';

        const provider = registry.get(providerName);

        const stream = provider.stream({
            model,
            signal: controller.signal,
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: 'Hello Polyglot streaming!',
                        },
                    ],
                },
            ],
        });

        for await (const event of stream) {
            res.write(`data: ${JSON.stringify(event)}\n\n`);
        }

        res.end();
    } catch (error) {
        console.error(error);

        res.write(
            `data: ${JSON.stringify({
                type: 'error',
                error: 'Request failed',
            })}\n\n`
        );

        res.end();
    }
});

app.get('/gemini-test', async (req, res) => {
    try {
        const provider = registry.get('gemini');

        const response = await provider.complete({
            model: 'gemini-flash',
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: 'Say hello from Gemini in one short sentence.',
                        },
                    ],
                },
            ],
        });

        res.json(response);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: 'Gemini request failed',
        });
    }
});

app.get('/openai-test', async (req, res) => {
  try {
    const provider = registry.get('openai');

    const response = await provider.complete({
      model: 'openai-luna',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Say hello from OpenAI in one short sentence.',
            },
          ],
        },
      ],
    });

    res.json(response);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: 'OpenAI request failed',
    });
  }
});

app.listen(port, () => {
    console.log(
        `Polyglot backend is running on http://localhost:${port}`
    );
});