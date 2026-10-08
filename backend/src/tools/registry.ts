import type { Tool } from './types.js';

export class ToolRegistry {
    private tools = new Map<string, Tool>();

    register(tool: Tool): void {
        this.tools.set(tool.name, tool);
    }

    get(name: string): Tool {
        const tool = this.tools.get(name);

        if (!tool) {
            throw new Error(
                `Tool "${name}" is not registered`
            );
        }

        return tool;
    }

    list(): Tool[] {
        return Array.from(this.tools.values());
    }
}