export interface ToolExecutionContext {
    tenantId: string;
}

export interface Tool {
    readonly name: string;
    readonly description: string;
    readonly parameters: Record<string, unknown>;

    execute(
        input: Record<string, unknown>,
        context: ToolExecutionContext
    ): Promise<string>;
}