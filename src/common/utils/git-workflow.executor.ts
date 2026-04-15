import { CommandOptions, executeLocalCommand } from './local-command.executor'

export interface PrepareFeatureBranchInput {
    projectPath: string
    projectName: string
    featureTitle: string
    baseBranch?: string
    timeoutMs?: number
}

export interface PrepareFeatureBranchResult {
    branchName: string
    syncStrategy: 'normal-pull' | 'rebase' | 'merge'
}

export async function prepareFeatureBranch(
    input: PrepareFeatureBranchInput
): Promise<PrepareFeatureBranchResult> {
    const {
        projectPath,
        projectName,
        featureTitle,
        baseBranch = 'main',
        timeoutMs,
    } = input

    const branchName = buildFeatureBranchName(projectName, featureTitle)
    const commandOptions: CommandOptions = {
        cwd: projectPath,
        timeoutMs,
    }

    await runOrThrow(`git switch ${baseBranch}`, commandOptions, `Failed to switch to ${baseBranch}`)

    let syncStrategy: PrepareFeatureBranchResult['syncStrategy'] = 'normal-pull'
    const pullResult = await executeLocalCommand(`git pull origin ${baseBranch}`, commandOptions)

    if (pullResult.exitCode !== 0) {
        syncStrategy = await syncDivergedBranch(baseBranch, commandOptions, pullResult.stderr || pullResult.stdout)
    }

    await runOrThrow(`git checkout -b ${branchName}`, commandOptions, `Failed to create branch ${branchName}`)

    return {
        branchName,
        syncStrategy,
    }
}

export function buildFeatureBranchName(projectName: string, featureTitle: string): string {
    return `feature/${sanitizeGitSegment(projectName)}/${sanitizeGitSegment(featureTitle)}`
}

function sanitizeGitSegment(value: string): string {
    const sanitized = value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')

    return sanitized || 'unscoped'
}

async function syncDivergedBranch(
    baseBranch: string,
    options: CommandOptions,
    originalError: string
): Promise<PrepareFeatureBranchResult['syncStrategy']> {
    await runOrThrow('git fetch origin', options, `Failed to fetch origin after pull failed: ${originalError}`)

    const divergenceCheck = await executeLocalCommand(
        `git rev-list --left-right --count HEAD...origin/${baseBranch}`,
        options
    )

    if (divergenceCheck.exitCode !== 0) {
        throw new Error(`Failed to compare local branch with origin/${baseBranch}: ${divergenceCheck.stderr || divergenceCheck.stdout}`)
    }

    const [aheadCountRaw, behindCountRaw] = divergenceCheck.stdout.trim().split(/\s+/)
    const aheadCount = Number.parseInt(aheadCountRaw ?? '0', 10)
    const behindCount = Number.parseInt(behindCountRaw ?? '0', 10)

    if (!Number.isFinite(aheadCount) || !Number.isFinite(behindCount)) {
        throw new Error(`Unexpected divergence output: ${divergenceCheck.stdout}`)
    }

    if (aheadCount > 0 && behindCount > 0) {
        const rebaseResult = await executeLocalCommand(`git rebase origin/${baseBranch}`, options)
        if (rebaseResult.exitCode === 0) {
            await ensureCleanGitState(options)
            return 'rebase'
        }

        await runOrThrow('git rebase --abort', options, 'Failed to abort rebase after rebase conflict')
        await runOrThrow(`git merge origin/${baseBranch}`, options, `Failed to merge origin/${baseBranch} after rebase failure`)
        await ensureCleanGitState(options)
        return 'merge'
    }

    if (behindCount > 0) {
        await runOrThrow(`git merge --ff-only origin/${baseBranch}`, options, `Failed to fast-forward from origin/${baseBranch}`)
    }

    await ensureCleanGitState(options)
    return 'normal-pull'
}

async function ensureCleanGitState(options: CommandOptions): Promise<void> {
    const gitDirResult = await executeLocalCommand('git rev-parse --git-dir', options)
    if (gitDirResult.exitCode !== 0) {
        throw new Error(`Failed to resolve .git directory: ${gitDirResult.stderr || gitDirResult.stdout}`)
    }

    const gitDir = gitDirResult.stdout.trim()
    const stateCheck = await executeLocalCommand(
        `[ ! -f "${gitDir}/MERGE_HEAD" ] && [ ! -d "${gitDir}/rebase-merge" ] && [ ! -d "${gitDir}/rebase-apply" ]`,
        options
    )

    if (stateCheck.exitCode !== 0) {
        throw new Error('Repository still has an active merge or rebase state.')
    }
}

async function runOrThrow(command: string, options: CommandOptions, message: string): Promise<void> {
    const result = await executeLocalCommand(command, options)
    if (result.exitCode !== 0) {
        throw new Error(`${message}: ${result.stderr || result.stdout}`)
    }
}
