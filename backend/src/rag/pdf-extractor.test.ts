import { describe, expect, it } from 'vitest';
import PDFDocument from 'pdfkit';

import { extractTextFromPdf } from './pdf-extractor.js';

function createTestPdf(): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const document = new PDFDocument();
        const chunks: Buffer[] = [];

        document.on('data', (chunk) => {
            chunks.push(chunk);
        });

        document.on('end', () => {
            resolve(Buffer.concat(chunks));
        });

        document.on('error', reject);

        document
            .fontSize(16)
            .text(
                'React is a JavaScript library for building user interfaces.'
            );

        document.end();
    });
}

describe('PDF extractor', () => {
    it('extracts text from a PDF', async () => {
        const pdf = await createTestPdf();

        const text = await extractTextFromPdf(pdf);

        expect(text).toContain(
            'React is a JavaScript library'
        );
    });

    it('rejects an empty PDF buffer', async () => {
        await expect(
            extractTextFromPdf(Buffer.alloc(0))
        ).rejects.toThrow('PDF is empty');
    });
});