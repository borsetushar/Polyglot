export interface ChunkOptions {
    chunkSize: number;
    overlap: number;
}

export function chunkText(
    text: string,
    options: ChunkOptions
): string[] {
    const { chunkSize, overlap } = options;

    if (chunkSize <= 0) {
        throw new Error(
            'chunkSize must be greater than 0'
        );
    }

    if (overlap < 0 || overlap >= chunkSize) {
        throw new Error(
            'overlap must be greater than or equal to 0 and smaller than chunkSize'
        );
    }

    const normalizedText = text.trim();

    if (!normalizedText) {
        return [];
    }

    const chunks: string[] = [];
    let start = 0;

    while (start < normalizedText.length) {
        const maxEnd = Math.min(
            start + chunkSize,
            normalizedText.length
        );

        if (maxEnd === normalizedText.length) {
            chunks.push(
                normalizedText.slice(start).trim()
            );
            break;
        }

        let end = maxEnd;

        const paragraphBreak =
            normalizedText.lastIndexOf(
                '\n\n',
                maxEnd
            );

        const sentenceBreak = Math.max(
            normalizedText.lastIndexOf('. ', maxEnd),
            normalizedText.lastIndexOf('? ', maxEnd),
            normalizedText.lastIndexOf('! ', maxEnd)
        );

        if (paragraphBreak > start) {
            end = paragraphBreak + 2;
        } else if (sentenceBreak > start) {
            end = sentenceBreak + 1;
        }

        const chunk =
            normalizedText.slice(start, end).trim();

        if (chunk) {
            chunks.push(chunk);
        }

        if (end >= normalizedText.length) {
            break;
        }

        start = Math.max(
            end - overlap,
            start + 1
        );
    }

    return chunks;
}