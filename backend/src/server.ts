import 'dotenv/config';
import express, {
    type Request,
    type Response,
    type NextFunction,
} from 'express';

import { ensureTenant } from './db/tenant-repository.js';
import { getUsage } from './db/conversation-repository.js';

import {
    documentRoute,
    documentUpload,
} from './routes/documents.js';

import { chatRoute } from './routes/chat.js';

import { providerRegistry } from './providers/index.js';

const app = express();

const port = Number(
    process.env.PORT ?? 3000
);

const MAX_JSON_SIZE = '1mb';

app.use(
    express.json({
        limit: MAX_JSON_SIZE,
    })
);

/*
 * Basic security headers.
 *
 * We intentionally keep this dependency-free rather than
 * introducing another package just for a few headers.
 */
app.disable('x-powered-by');

app.use(
    (
        _req: Request,
        res: Response,
        next: NextFunction
    ) => {
        res.setHeader(
            'X-Content-Type-Options',
            'nosniff'
        );

        res.setHeader(
            'X-Frame-Options',
            'DENY'
        );

        res.setHeader(
            'Referrer-Policy',
            'no-referrer'
        );

        next();
    }
);

/*
 * Simple in-memory rate limiter.
 *
 * This is intentionally basic for the take-home project.
 * In production, this should move to Redis or another
 * shared store so limits work across multiple servers.
 */
const requestCounts = new Map<
    string,
    {
        count: number;
        resetAt: number;
    }
>();

const RATE_LIMIT_WINDOW_MS =
    60 * 1000;

const RATE_LIMIT_MAX_REQUESTS = 60;

app.use(
    (
        req: Request,
        res: Response,
        next: NextFunction
    ) => {
        const key =
            req.ip ?? 'unknown';

        const now = Date.now();

        const existing =
            requestCounts.get(key);

        if (
            !existing ||
            existing.resetAt <= now
        ) {
            requestCounts.set(key, {
                count: 1,
                resetAt:
                    now +
                    RATE_LIMIT_WINDOW_MS,
            });

            next();
            return;
        }

        existing.count++;

        if (
            existing.count >
            RATE_LIMIT_MAX_REQUESTS
        ) {
            res.status(429).json({
                error:
                    'Too many requests. Please try again later.',
            });

            return;
        }

        next();
    }
);

/*
 * Demo tenant.
 *
 * In a real authenticated application this would come
 * from the authenticated user's tenant rather than the
 * request body.
 */
ensureTenant(
    'tenant-a',
    'Demo Tenant'
);

/*
 * Health / basic endpoint.
 */
app.get(
    '/',
    async (_req, res) => {
        try {
            const provider =
                providerRegistry.get(
                    'test'
                );

            const response =
                await provider.complete({
                    model:
                        'test-model',
                    messages: [
                        {
                            role: 'user',
                            content: [
                                {
                                    type: 'text',
                                    text:
                                        'Hello Polyglot!',
                                },
                            ],
                        },
                    ],
                });

            res.json(response);
        } catch (error) {
            console.error(
                'Health endpoint error:',
                error
            );

            res.status(500).json({
                error:
                    'Request failed',
            });
        }
    }
);

/*
 * Streaming demo endpoint.
 */
app.get(
    '/stream',
    async (req, res) => {
        const controller =
            new AbortController();

        req.on('close', () => {
            controller.abort();
        });

        res.setHeader(
            'Content-Type',
            'text/event-stream'
        );

        res.setHeader(
            'Cache-Control',
            'no-cache'
        );

        res.setHeader(
            'Connection',
            'keep-alive'
        );

        try {
            const providerName =
                req.query.provider
                    ?.toString() ??
                'test';

            const model =
                req.query.model
                    ?.toString() ??
                'test-model';

            const provider =
                providerRegistry.get(
                    providerName
                );

            const stream =
                provider.stream({
                    model,
                    signal:
                        controller.signal,
                    messages: [
                        {
                            role: 'user',
                            content: [
                                {
                                    type: 'text',
                                    text:
                                        'Hello Polyglot streaming!',
                                },
                            ],
                        },
                    ],
                });

            for await (
                const event of stream
            ) {
                res.write(
                    `data: ${JSON.stringify(event)}\n\n`
                );
            }

            res.end();
        } catch (error) {
            console.error(
                'Stream error:',
                error
            );

            if (!res.headersSent) {
                res.status(500).json({
                    error:
                        'Request failed',
                });

                return;
            }

            res.write(
                `data: ${JSON.stringify({
                    type: 'error',
                    error:
                        'Request failed',
                })}\n\n`
            );

            res.end();
        }
    }
);

/*
 * Provider test endpoints.
 *
 * These are useful during development but should not
 * be exposed in production.
 */
if (
    process.env.NODE_ENV !==
    'production'
) {
    app.get(
        '/gemini-test',
        async (_req, res) => {
            try {
                const provider =
                    providerRegistry.get(
                        'gemini'
                    );

                const response =
                    await provider.complete({
                        model:
                            'gemini-flash',
                        messages: [
                            {
                                role: 'user',
                                content: [
                                    {
                                        type: 'text',
                                        text:
                                            'Say hello from Gemini in one short sentence.',
                                    },
                                ],
                            },
                        ],
                    });

                res.json(response);
            } catch (error) {
                console.error(
                    'Gemini test error:',
                    error
                );

                res.status(500).json({
                    error:
                        'Provider request failed',
                });
            }
        }
    );

    app.get(
        '/openai-test',
        async (_req, res) => {
            try {
                const provider =
                    providerRegistry.get(
                        'openai'
                    );

                const response =
                    await provider.complete({
                        model:
                            'openai-luna',
                        messages: [
                            {
                                role: 'user',
                                content: [
                                    {
                                        type: 'text',
                                        text:
                                            'Say hello from OpenAI in one short sentence.',
                                    },
                                ],
                            },
                        ],
                    });

                res.json(response);
            } catch (error) {
                console.error(
                    'OpenAI test error:',
                    error
                );

                res.status(500).json({
                    error:
                        'Provider request failed',
                });
            }
        }
    );
}

/*
 * Main application routes.
 */
app.post(
    '/api/chat',
    chatRoute
);

app.post(
    '/api/documents',
    documentUpload,
    documentRoute
);

/*
 * Usage endpoint.
 *
 * For the current demo architecture, tenantId is still
 * supplied by the caller. In a production system it must
 * come from authentication/session context.
 */
app.get(
    '/api/usage',
    (req, res) => {
        const tenantId =
            req.query.tenantId
                ?.toString()
                .trim();

        if (!tenantId) {
            res.status(400).json({
                error:
                    'tenantId is required',
            });

            return;
        }

        const usage =
            getUsage(tenantId);

        res.json({
            tenantId,
            usage,
        });
    }
);

/*
 * Global error handler.
 *
 * Never send raw provider/internal errors
 * to the client.
 */
app.use(
    (
        error: unknown,
        _req: Request,
        res: Response,
        _next: NextFunction
    ) => {
        console.error(
            'Unhandled application error:',
            error
        );

        if (res.headersSent) {
            return;
        }

        res.status(500).json({
            error:
                'Internal server error',
        });
    }
);

app.listen(
    port,
    () => {
        console.log(
            `Polyglot backend is running on http://localhost:${port}`
        );
    }
);