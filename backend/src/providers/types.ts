export type Role = 'user' | 'assistant' | 'tool';

export interface ContentBlock {
    type: 'text' | 'image' | 'tool_use' | 'tool_result';

    text?: string;

    mimeType?: string;
    data?: string;

    id?: string;
    name?: string;
    input?: Record<string, unknown>;

    toolUseId?: string;
    content?: string;
    isError?: boolean;
}

export interface Message {
    role: Role;
    content: ContentBlock[];
}

export interface ToolDefinition {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
}

export interface CompletionRequest {
    model: string;
    messages: Message[];

    system?: string;

    tools?: ToolDefinition[];

    maxTokens?: number;
    temperature?: number;

    signal?: AbortSignal;
}

export interface Usage {
    inputTokens: number;
    outputTokens: number;

    cachedInputTokens?: number;
    reasoningTokens?: number;
}

export type FinishReason =
    | 'stop'
    | 'max_tokens'
    | 'tool_use'
    | 'content_filter'
    | 'error';

export interface CompletionResponse {
    content: ContentBlock[];
    usage: Usage;
    finishReason: FinishReason;
}

export type StreamEvent =
    | { type: 'text_delta'; text: string }
    | { type: 'tool_use_start'; id: string; name: string }
    | { type: 'tool_use_delta'; id: string; partialJson: string }
    | {
        type: 'tool_use_complete';
        id: string;
        name: string;
        input: Record<string, unknown>;
    }
    | { type: 'usage'; usage: Usage }
    | { type: 'done'; finishReason: FinishReason }
    | { type: 'error'; error: ProviderError };

export type ErrorKind =
    | 'auth'
    | 'rate_limit'
    | 'context_length'
    | 'content_filter'
    | 'timeout'
    | 'server_error'
    | 'bad_request';

export interface ProviderError extends Error {
    kind: ErrorKind;
    provider: string;
    retryable: boolean;
    retryAfterMs?: number;
    raw?: unknown;
}

export interface Provider {
    readonly name: string;

    complete(
        req: CompletionRequest
    ): Promise<CompletionResponse>;

    stream(
        req: CompletionRequest
    ): AsyncIterable<StreamEvent>;

    embed?(
        texts: string[],
        model: string
    ): Promise<number[][]>;
}