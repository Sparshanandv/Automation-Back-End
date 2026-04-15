
export function parseAiJson(raw: string): any {
    const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/g;
    const matches = Array.from(raw.matchAll(codeBlockRegex));

    if (matches.length > 0) {
        for (let i = matches.length - 1; i >= 0; i--) {
            const blockContent = matches[i][1].trim();
            try {
                return JSON.parse(blockContent);
            } catch (e) {
            }
        }
    }

    const trimmed = raw.trim();
    try {
        return JSON.parse(trimmed);
    } catch (initialError) {
        const arrayStart = trimmed.indexOf('[');
        const arrayEnd = trimmed.lastIndexOf(']');
        const objectStart = trimmed.indexOf('{');
        const objectEnd = trimmed.lastIndexOf('}');

        if (arrayStart === -1 && objectStart === -1) {
            throw initialError;
        }

        // Try to extract an array if it exists
        if (arrayStart !== -1 && arrayEnd !== -1) {
            let currentStart = arrayStart;
            while (currentStart !== -1 && currentStart < arrayEnd) {
                const extractedArray = trimmed.substring(currentStart, arrayEnd + 1);
                try {
                    return JSON.parse(extractedArray);
                } catch (e) {
                    currentStart = trimmed.indexOf('[', currentStart + 1);
                }
            }
        }

        // Try to extract an object if it exists
        if (objectStart !== -1 && objectEnd !== -1) {
            let currentStart = objectStart;
            while (currentStart !== -1 && currentStart < objectEnd) {
                const extractedObject = trimmed.substring(currentStart, objectEnd + 1);
                try {
                    return JSON.parse(extractedObject);
                } catch (e) {
                    currentStart = trimmed.indexOf('{', currentStart + 1);
                }
            }
        }

        throw initialError;
    }
}
