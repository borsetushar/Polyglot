import type {
    Tool,
    ToolExecutionContext,
} from './types.js';
import { embeddingRegistry } from '../rag/index.js';
import { retrieveRelevantChunks } from '../rag/retrieval-service.js';

export class SearchDocumentsTool implements Tool {
    readonly name = 'search_documents';

   readonly description =
    'Search the tenant knowledge base for information in uploaded documents. Use this tool when the user asks a question that may be answered by their documents. Search once with a concise query. After receiving the results, answer the user directly using the retrieved content. Do not call this tool repeatedly to refine the same search. If the results do not contain the answer, say that the uploaded documents do not provide enough information.';
    
    readonly parameters = {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description:
                    'The question or search query to find relevant document content.',
            },
            topK: {
                type: 'integer',
                description:
                    'Maximum number of relevant document chunks to return.',
                minimum: 1,
                maximum: 5,
            },
        },
        required: ['query'],
    };

    async execute(
        input: Record<string, unknown>,
        context: ToolExecutionContext
    ): Promise<string> {
        const tenantId = context.tenantId;
        
        const query = input.query;

        if (typeof query !== 'string' || !query.trim()) {
            throw new Error(
                'query is required'
            );
        }

        const topK =
            typeof input.topK === 'number'
                ? Math.min(
                    Math.max(
                        Math.floor(input.topK),
                        1
                    ),
                    5
                )
                : 3;

        const embeddingProvider =
            embeddingRegistry.get('test');

        const results =
            await retrieveRelevantChunks(
                tenantId,
                query,
                embeddingProvider,
                topK
            );

        if (results.length === 0) {
            return 'No relevant documents were found.';
        }

        return results
            .map((result, index) => {
                return `[Source ${index + 1}]
Filename: ${result.chunk.filename}
Score: ${result.score.toFixed(4)}
${result.chunk.text}`;
            })
            .join('\n\n');
    }
}