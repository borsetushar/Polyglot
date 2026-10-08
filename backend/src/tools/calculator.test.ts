import { describe, expect, it } from 'vitest';

import { CalculatorTool } from './calculator.js';

describe('CalculatorTool', () => {
    const calculator = new CalculatorTool();

    it('calculates multiplication', async () => {
        const result =
            await calculator.execute({
                expression: '25 * 18',
            });

        expect(result).toBe('450');
    });

    it('respects operator precedence', async () => {
        const result =
            await calculator.execute({
                expression: '10 + 5 * 2',
            });

        expect(result).toBe('20');
    });

    it('supports parentheses', async () => {
        const result =
            await calculator.execute({
                expression: '(10 + 5) * 2',
            });

        expect(result).toBe('30');
    });

    it('rejects unsupported characters', async () => {
        await expect(
            calculator.execute({
                expression:
                    'process.exit()',
            })
        ).rejects.toThrow();
    });

    it('rejects division by zero', async () => {
        await expect(
            calculator.execute({
                expression: '10 / 0',
            })
        ).rejects.toThrow(
            'Division by zero'
        );
    });
    
});