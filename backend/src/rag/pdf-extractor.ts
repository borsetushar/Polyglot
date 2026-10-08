import { PDFParse } from 'pdf-parse';

export async function extractTextFromPdf(
    buffer: Buffer
): Promise<string> {
    if (buffer.length === 0) {
        throw new Error('PDF is empty');
    }

    const parser = new PDFParse({
        data: buffer,
    });

    const result = await parser.getText();

    const text = result.text.trim();

    await parser.destroy();

    if (!text) {
        throw new Error(
            'PDF does not contain extractable text'
        );
    }

    return text;
}