
export function parseAiJson(raw: string): any {
    let cleaned = raw.replace(/```(?:json)?\s*([\s\S]*?)\s*```/g, '$1').trim()

    try {
        return JSON.parse(cleaned)
    } catch (initialError) {
        const arrayStart = cleaned.indexOf('[')
        const arrayEnd = cleaned.lastIndexOf(']')
        const objectStart = cleaned.indexOf('{')
        const objectEnd = cleaned.lastIndexOf('}')

        let extracted: string | null = null

        if (arrayStart !== -1 && arrayEnd !== -1 && (objectStart === -1 || arrayStart < objectStart)) {
            extracted = cleaned.substring(arrayStart, arrayEnd + 1)
        } else if (objectStart !== -1 && objectEnd !== -1) {
            extracted = cleaned.substring(objectStart, objectEnd + 1)
        }

        if (extracted) {
            try {
                return JSON.parse(extracted)
            } catch (extractionError) {
                console.error('Failed to parse extracted JSON:', extracted)
                throw initialError 
            }
        }
        
        throw initialError
    }
}
