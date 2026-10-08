import {
    describe,
    expect,
    it,
} from 'vitest';

import { executeTool } from './executor.js';

describe('executeTool', () => {
    it('rejects invalid tool input', async () => {
        const result = await executeTool(
            'calculator',
            null as unknown as Record<string, unknown>,
            {
                tenantId: 'test-tenant',
            }
        );

        expect(result.isError).toBe(true);
        expect(result.content).toBe(
            'Invalid tool input'
        );
    });
});