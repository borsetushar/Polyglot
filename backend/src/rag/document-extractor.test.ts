import { describe, expect, it } from 'vitest';
import { extractTextFromContent } from './document-extractor.js';

describe('document extractor', () => {
    it('accepts txt files', () => {
        const result = extractTextFromContent(
            'notes.txt',
            'Hello world'
        );

        expect(result).toBe('Hello world');
    });

    it('accepts markdown files', () => {
        const result = extractTextFromContent(
            'notes.md',
            '# React\nReact is a library.'
        );

        expect(result).toBe(
            '# React\nReact is a library.'
        );
    });

    it('rejects unsupported file types', () => {
        expect(() =>
            extractTextFromContent(
                'notes.exe',
                'some content'
            )
        ).toThrow('Unsupported document type');
    });

    it('rejects empty documents', () => {
        expect(() =>
            extractTextFromContent(
                'notes.txt',
                '   '
            )
        ).toThrow('Document is empty');
    });
});