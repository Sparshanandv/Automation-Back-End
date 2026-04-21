import fs from 'fs'
import path from 'path'
import { scanRepositoryContext, formatRepoContextForPrompt, RepoContext } from './repo-context-reader'

/** Matches code-gen repo selection: prefer BE, else any linked repo. */
export function pickPrimaryRepo<T extends { purpose: string }>(repos: T[]): T | undefined {
    return repos.find((r) => r.purpose === 'BE') || repos[0]
}

export interface RepoPathInput {
    purpose: string
    localPath?: string | null
}

/**
 * Same resolution as execute.orchestrator: primary repo's localPath if set,
 * else `${LOCAL_REPO_PATH}/${project.name}`.
 */
export function resolveLocalRepoPath(project: { name: string }, repos: RepoPathInput[]): string {
    const repo = pickPrimaryRepo(repos)
    const trimmed = repo?.localPath?.trim()
    if (trimmed) {
        return trimmed
    }
    return `${process.env.LOCAL_REPO_PATH}/${project.name}`
}

/**
 * Top-level listing for Bedrock prompts — same filters as code generation.
 * @deprecated Use getRepositoryContext instead for better context
 */
export function snapshotRepoTopLevel(repoPath: string): {
    repoFolderName: string
    topLevelEntries: string
} {
    const repoFolderName = path.basename(repoPath)
    const topLevelEntries = fs
        .readdirSync(repoPath)
        .filter((e) => !e.startsWith('.') && e !== 'node_modules' && e !== 'dist')
        .slice(0, 30)
        .join(', ')
    return { repoFolderName, topLevelEntries }
}

/**
 * Get comprehensive repository context including file contents
 */
export function getRepositoryContext(repoPath: string): RepoContext {
    return scanRepositoryContext(repoPath, {
        maxFiles: 40,
        maxCharsPerFile: 8000,
        maxDepth: 4,
    })
}

/**
 * Format repository context for AI prompts
 */
export function formatRepositoryContext(context: RepoContext): string {
    return formatRepoContextForPrompt(context)
}
