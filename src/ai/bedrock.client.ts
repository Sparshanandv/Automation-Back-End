import {
    BedrockRuntimeClient,
    InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime'

let client: BedrockRuntimeClient | null = null

function getClient() {
    if (!client) {
        client = new BedrockRuntimeClient({
            region: process.env.AWS_REGION,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
            },
        })
    }
    return client
}

const getModelId = () => process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-sonnet-20240229-v1:0'

export async function invoke(prompt: string): Promise<string> {
    const body = JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
    })

    const command = new InvokeModelCommand({
        modelId: getModelId(),
        contentType: 'application/json',
        accept: 'application/json',
        body: new TextEncoder().encode(body),
    })

    const response = await getClient().send(command)
    const decoded = new TextDecoder().decode(response.body)
    const parsed = JSON.parse(decoded)

    return parsed.content[0].text
}
