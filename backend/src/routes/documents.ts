import type { Request, Response } from 'express';
import multer from 'multer';

import { getTenant } from '../db/tenant-repository.js';
import { ingestDocument } from '../rag/ingestion-service.js';
import { TestEmbeddingProvider } from '../rag/test-embedding-provider.js';
import { extractTextFromContent } from '../rag/document-extractor.js';
import { extractTextFromPdf } from '../rag/pdf-extractor.js';

interface DocumentRequest {
    tenantId: string;
    filename: string;
    text: string;
}

const embeddingProvider = new TestEmbeddingProvider();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
});

export const documentUpload = upload.single('file');

export async function documentRoute(
    req: Request,
    res: Response
): Promise<void> {
    try {
        const tenantId =
            typeof req.body.tenantId === 'string'
                ? req.body.tenantId
                : undefined;

        if (!tenantId) {
            res.status(400).json({
                error: 'tenantId is required',
            });

            return;
        }

        const tenant = getTenant(tenantId);

        if (!tenant) {
            res.status(400).json({
                error: 'Tenant does not exist',
            });

            return;
        }

        /*
         * File upload path
         */
        if (req.file) {
            const filename = req.file.originalname;

            let text: string;

            if (filename.toLowerCase().endsWith('.pdf')) {
                text = await extractTextFromPdf(
                    req.file.buffer
                );
            } else {
                text = extractTextFromContent(
                    filename,
                    req.file.buffer.toString('utf-8')
                );
            }

            await ingestDocument(
                {
                    tenantId,
                    filename,
                    text,
                },
                embeddingProvider
            );

            res.status(201).json({
                message: 'Document ingested successfully',
                filename,
            });

            return;
        }

        /*
         * Existing JSON path
         */
        const body = req.body as Partial<DocumentRequest>;

        if (
            typeof body.filename !== 'string' ||
            typeof body.text !== 'string'
        ) {
            res.status(400).json({
                error: 'Either a file or document text is required',
            });

            return;
        }

        const text = extractTextFromContent(
            body.filename,
            body.text
        );

        await ingestDocument(
            {
                tenantId,
                filename: body.filename,
                text,
            },
            embeddingProvider
        );

        res.status(201).json({
            message: 'Document ingested successfully',
            filename: body.filename,
        });
    } catch (error) {
        console.error('Document ingestion error:', error);

        if (
            error instanceof multer.MulterError &&
            error.code === 'LIMIT_FILE_SIZE'
        ) {
            res.status(413).json({
                error: 'File size must not exceed 5 MB',
            });

            return;
        }

        const message =
            error instanceof Error
                ? error.message
                : 'Document ingestion failed';

        if (
            message.startsWith('Unsupported document type') ||
            message === 'Document is empty' ||
            message ===
                'PDF does not contain extractable text'
        ) {
            res.status(400).json({
                error: message,
            });

            return;
        }

        res.status(500).json({
            error: 'Document ingestion failed',
        });
    }
}