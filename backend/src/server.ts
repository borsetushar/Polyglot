import 'dotenv/config';
import express from 'express';
import { ensureTenant } from './db/tenant-repository.js';
import { getUsage } from './db/conversation-repository.js';

import { chatRoute } from './routes/chat.js';
import { ProviderRegistry } from './providers/registry.js';
import { TestProvider } from './providers/test-provider.js';
import { GeminiProvider } from './providers/gemini.js';
import { OpenAIProvider } from './providers/openai.js';

const app = express();

app.use(express.json());

const port: number = 3000;

ensureTenant('tenant-a', 'Demo Tenant');

import { providerRegistry } from './providers/index.js';

app.get('/', async (req, res) => {
    try {
        const provider = providerRegistry.get('test')

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

        const provider = providerRegistry.get(providerName)

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
        const provider = providerRegistry.get('gemini')

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
        const provider = providerRegistry.get('openai')

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

app.post('/api/chat', chatRoute);

app.get('/api/usage', (req, res) => {
    const tenantId = req.query.tenantId?.toString();

    if (!tenantId) {
        res.status(400).json({
            error: 'tenantId is required',
        });

        return;
    }

    const usage = getUsage(tenantId);

    res.json({
        tenantId,
        usage,
    });
});

app.listen(port, () => {
    console.log(
        `Polyglot backend is running on http://localhost:${port}`
    );
});