import { toolRegistry } from './index.js';
import type { ToolDefinition } from '../providers/types.js';

export function getToolDefinitions(): ToolDefinition[] {
    return toolRegistry.list().map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
    }));
}