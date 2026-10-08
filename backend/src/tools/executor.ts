import { toolRegistry } from './index.js';
import type { ToolExecutionContext } from './types.js';

export async function executeTool(
    name: string,
    input: Record<string, unknown>,
    context: ToolExecutionContext
): Promise<{
    content: string;
    isError: boolean;
}> {
    try {
        if (
            !input ||
            typeof input !== 'object' ||
            Array.isArray(input)
        ) {
            return {
                content: 'Invalid tool input',
                isError: true,
            };
        }

        const tool = toolRegistry.get(name);

        const content =
            await tool.execute(
                input,
                context
            );

        return {
            content,
            isError: false,
        };
    } catch (error) {
        return {
            content:
                error instanceof Error
                    ? error.message
                    : 'Tool execution failed',
            isError: true,
        };
    }
}