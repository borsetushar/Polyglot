import { describe, expect, it } from 'vitest';
import { chunkText } from './chunker.js';

describe('chunkText', () => {
    it('splits text into overlapping chunks', () => {
        const text = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

        const chunks = chunkText(text, {
            chunkSize: 10,
            overlap: 2,
        });

        expect(chunks).toEqual([
            'ABCDEFGHIJ',
            'IJKLMNOPQR',
            'QRSTUVWXYZ',
        ]);
    });
});