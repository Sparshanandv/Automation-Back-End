export function buildQaPrompt(feature: {
    title: string
    description: string
    criteria: string
}): string {
    return `You are a senior QA engineer. Generate comprehensive test cases for the following feature.

FEATURE TITLE: ${feature.title}

FEATURE DESCRIPTION: ${feature.description}

ACCEPTANCE CRITERIA: ${feature.criteria}

Return ONLY a raw JSON array. No explanation. No markdown. No code fences.

Each element must follow this exact structure:
{
  "id": "TC-001",
  "title": "Short test case title",
  "steps": ["Step 1", "Step 2", "Step 3"],
  "expected": "Expected result description",
  "type": "functional | edge | negative"
}

The "type" field must be one of: "functional", "edge", or "negative".

Cover:
- All acceptance criteria (functional tests)
- Boundary and edge cases (edge tests)
- Invalid inputs and error scenarios (negative tests)

Return ONLY the JSON array.`
}

export function buildQaRegenerationPrompt(
    feature: { title: string; description: string; criteria: string },
    previousContent: any,
    promptToRegenerateQa?: string
): string {
    const feedbackSection = promptToRegenerateQa
        ? `USER FEEDBACK / REGENERATION PROMPT:
"${promptToRegenerateQa}"`
        : 'USER FEEDBACK: Please regenerate and improve the previous test cases.'

    return `You are a senior QA engineer. You previously generated test cases for the feature below, but the user has requested a regeneration.

FEATURE TITLE: ${feature.title}
FEATURE DESCRIPTION: ${feature.description}
ACCEPTANCE CRITERIA: ${feature.criteria}

PREVIOUS TEST CASES:
${JSON.stringify(previousContent, null, 2)}

${feedbackSection}

REVISE the test cases based ON THE FEEDBACK. 
Maintain the same JSON structure. 
Return ONLY the raw JSON array. No explanation. No markdown. No code fences.

Each element structure:
{
  "id": "TC-001",
  "title": "Short test case title",
  "steps": ["Step 1", "Step 2", "Step 3"],
  "expected": "Expected result description",
  "type": "functional | edge | negative"
}

The "type" field must be one of: "functional", "edge", or "negative".

Return ONLY the JSON array.`
}
