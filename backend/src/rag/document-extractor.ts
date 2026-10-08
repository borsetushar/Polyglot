export function extractTextFromContent(
    filename: string,
    content: string
): string {
    const extension =
        filename.split('.').pop()?.toLowerCase();

    if (
        extension !== 'txt' &&
        extension !== 'md' &&
        extension !== 'markdown'
    ) {
        throw new Error(
            `Unsupported document type: .${extension ?? 'unknown'}`
        );
    }

    const text = content.trim();

    if (!text) {
        throw new Error('Document is empty');
    }

    return text;
}