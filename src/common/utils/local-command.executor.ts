import { exec } from 'child_process'

export interface CommandResult {
    stdout: string
    stderr: string
    exitCode: number
}

export interface CommandOptions {
    cwd?: string
    timeoutMs?: number
    env?: Record<string, string>
}

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000 // 10 minutes

export function executeLocalCommand(
    command: string,
    options: CommandOptions = {}
): Promise<CommandResult> {
    const { cwd, timeoutMs = DEFAULT_TIMEOUT_MS, env } = options

    return new Promise((resolve, reject) => {
        const child = exec(
            command,
            {
                cwd,
                timeout: timeoutMs,
                maxBuffer: 50 * 1024 * 1024, // 50 MB — Claude Code can be verbose
                env: { ...process.env, ...env },
            },
            (error, stdout, stderr) => {
                if (error && (error as any).killed) {
                    return reject(new Error(`Command timed out after ${timeoutMs}ms: ${command}`))
                }

                // Resolve even on non-zero exit so callers can inspect exitCode
                resolve({
                    stdout: stdout ?? '',
                    stderr: stderr ?? '',
                    exitCode: error ? (error.code as unknown as number ?? 1) : 0,
                })
            }
        )

        // Safety: destroy the child if it somehow outlives the timeout
        child.on('error', (err) => reject(err))
    })
}
