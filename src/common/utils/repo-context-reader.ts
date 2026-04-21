import fs from 'fs'
import path from 'path'

/**
 * Configuration for how deeply to scan a repository
 */
export interface ScanOptions {
    /** Maximum number of files to read (default: 50) */
    maxFiles?: number
    /** Maximum characters per file (default: 10000) */
    maxCharsPerFile?: number
    /** File extensions to include (default: ['.ts', '.js', '.tsx', '.jsx', '.json']) */
    includeExtensions?: string[]
    /** Directories to exclude (default: node_modules, dist, build, coverage) */
    excludeDirs?: string[]
    /** Maximum depth to traverse (default: 5) */
    maxDepth?: number
}

export interface FileContent {
    relativePath: string
    content: string
    size: number
}

export interface RepoContext {
    repoPath: string
    repoFolderName: string
    topLevelEntries: string[]
    fileTree: string
    keyFiles: FileContent[]
    totalFilesScanned: number
    totalCharacters: number
    summary: string
}

const DEFAULT_OPTIONS: Required<ScanOptions> = {
    maxFiles: 50,
    maxCharsPerFile: 10000,
    includeExtensions: ['.ts', '.js', '.tsx', '.jsx', '.json', '.md'],
    excludeDirs: ['node_modules', 'dist', 'build', 'coverage', '.git', '.next', 'out', 'tmp'],
    maxDepth: 5,
}

/**
 * Reads a repository and extracts comprehensive context for AI prompts
 */
export function scanRepositoryContext(repoPath: string, options: ScanOptions = {}): RepoContext {
    const opts = { ...DEFAULT_OPTIONS, ...options }

    if (!fs.existsSync(repoPath)) {
        throw new Error(`Repository path does not exist: ${repoPath}`)
    }

    const repoFolderName = path.basename(repoPath)

    // Get top-level entries
    const topLevelEntries = fs
        .readdirSync(repoPath)
        .filter((e) => !e.startsWith('.') && !opts.excludeDirs.includes(e))
        .slice(0, 50)

    // Build file tree structure
    const fileTree = buildFileTree(repoPath, opts, 0)

    // Read key file contents
    const keyFiles = readKeyFiles(repoPath, opts)

    // Calculate stats
    const totalCharacters = keyFiles.reduce((sum, f) => sum + f.content.length, 0)
    const summary = generateSummary(repoPath, keyFiles, topLevelEntries)

    return {
        repoPath,
        repoFolderName,
        topLevelEntries,
        fileTree,
        keyFiles,
        totalFilesScanned: keyFiles.length,
        totalCharacters,
        summary,
    }
}

/**
 * Build a visual tree structure of the repository
 */
function buildFileTree(dir: string, opts: Required<ScanOptions>, depth: number): string {
    if (depth >= opts.maxDepth) return ''

    const entries = fs.readdirSync(dir, { withFileTypes: true })
    const lines: string[] = []
    const indent = '  '.repeat(depth)

    for (const entry of entries) {
        if (entry.name.startsWith('.') || opts.excludeDirs.includes(entry.name)) continue

        if (entry.isDirectory()) {
            lines.push(`${indent}${entry.name}/`)
            const subTree = buildFileTree(path.join(dir, entry.name), opts, depth + 1)
            if (subTree) lines.push(subTree)
        } else {
            const ext = path.extname(entry.name)
            if (opts.includeExtensions.includes(ext)) {
                lines.push(`${indent}${entry.name}`)
            }
        }
    }

    return lines.slice(0, 200).join('\n') // Limit tree size
}

/**
 * Read key files from the repository
 */
function readKeyFiles(repoPath: string, opts: Required<ScanOptions>): FileContent[] {
    const files: FileContent[] = []
    const priorityFiles: string[] = []
    const regularFiles: string[] = []

    // Collect all files
    collectFiles(repoPath, '', opts, priorityFiles, regularFiles)

    // Read priority files first (package.json, README, config files)
    for (const filePath of priorityFiles) {
        if (files.length >= opts.maxFiles) break
        const content = readFileContent(repoPath, filePath, opts.maxCharsPerFile)
        if (content) files.push(content)
    }

    // Then read regular files
    for (const filePath of regularFiles) {
        if (files.length >= opts.maxFiles) break
        const content = readFileContent(repoPath, filePath, opts.maxCharsPerFile)
        if (content) files.push(content)
    }

    return files
}

/**
 * Recursively collect file paths
 */
function collectFiles(
    repoPath: string,
    currentPath: string,
    opts: Required<ScanOptions>,
    priorityFiles: string[],
    regularFiles: string[],
    depth = 0
): void {
    if (depth >= opts.maxDepth) return

    const fullPath = path.join(repoPath, currentPath)
    const entries = fs.readdirSync(fullPath, { withFileTypes: true })

    for (const entry of entries) {
        if (entry.name.startsWith('.') || opts.excludeDirs.includes(entry.name)) continue

        const relativePath = path.join(currentPath, entry.name)
        const fullEntryPath = path.join(fullPath, entry.name)

        if (entry.isDirectory()) {
            collectFiles(repoPath, relativePath, opts, priorityFiles, regularFiles, depth + 1)
        } else {
            const ext = path.extname(entry.name)
            if (opts.includeExtensions.includes(ext)) {
                // Prioritize certain files
                if (isPriorityFile(entry.name, relativePath)) {
                    priorityFiles.push(relativePath)
                } else {
                    regularFiles.push(relativePath)
                }
            }
        }
    }
}

/**
 * Determine if a file should be read with priority
 */
function isPriorityFile(filename: string, relativePath: string): boolean {
    const priorityPatterns = [
        'package.json',
        'tsconfig.json',
        'README.md',
        'CLAUDE.md',
        '.env.example',
        'main.ts',
        'index.ts',
        'App.tsx',
        'app.ts',
    ]

    // Priority if in root or matches pattern
    const isRootLevel = !relativePath.includes(path.sep) || relativePath.split(path.sep).length <= 2
    const matchesPattern = priorityPatterns.some((pattern) => filename.toLowerCase().includes(pattern.toLowerCase()))

    return isRootLevel || matchesPattern
}

/**
 * Read and truncate file content
 */
function readFileContent(repoPath: string, relativePath: string, maxChars: number): FileContent | null {
    try {
        const fullPath = path.join(repoPath, relativePath)
        const stats = fs.statSync(fullPath)

        // Skip very large files
        if (stats.size > maxChars * 2) {
            return {
                relativePath,
                content: `[File too large: ${stats.size} bytes - skipped]`,
                size: stats.size,
            }
        }

        let content = fs.readFileSync(fullPath, 'utf-8')

        // Truncate if needed
        if (content.length > maxChars) {
            content = content.slice(0, maxChars) + `\n\n[... truncated, ${content.length - maxChars} more characters]`
        }

        return {
            relativePath: relativePath.replace(/\\/g, '/'), // Normalize paths
            content,
            size: stats.size,
        }
    } catch (err) {
        console.warn(`[RepoContext] Could not read ${relativePath}:`, err)
        return null
    }
}

/**
 * Generate a summary of the repository
 */
function generateSummary(repoPath: string, files: FileContent[], topLevelEntries: string[]): string {
    const hasPackageJson = files.some((f) => f.relativePath.includes('package.json'))
    const hasSrcDir = topLevelEntries.includes('src')
    const hasTests = files.some((f) => f.relativePath.includes('test') || f.relativePath.includes('spec'))

    let projectType = 'Unknown'
    if (hasPackageJson) {
        const pkgFile = files.find((f) => f.relativePath === 'package.json')
        if (pkgFile) {
            try {
                const pkg = JSON.parse(pkgFile.content)
                if (pkg.dependencies?.react || pkg.dependencies?.['@types/react']) {
                    projectType = 'React Frontend'
                } else if (pkg.dependencies?.express) {
                    projectType = 'Node.js Backend'
                } else if (pkg.dependencies?.next) {
                    projectType = 'Next.js Application'
                }
            } catch {
                // Invalid JSON
            }
        }
    }

    return `${projectType} project with ${files.length} key files scanned. ` +
           `Structure includes: ${topLevelEntries.slice(0, 5).join(', ')}. ` +
           `${hasTests ? 'Has test files.' : 'No test files found.'}`
}

/**
 * Format the repo context for inclusion in AI prompts
 */
export function formatRepoContextForPrompt(context: RepoContext): string {
    const sections: string[] = []

    // Summary
    sections.push(`## REPOSITORY CONTEXT`)
    sections.push(`Folder: ${context.repoFolderName}`)
    sections.push(`Summary: ${context.summary}`)
    sections.push(`Files analyzed: ${context.totalFilesScanned}`)
    sections.push('')

    // Top-level structure
    sections.push(`### Top-Level Structure`)
    sections.push(context.topLevelEntries.join(', '))
    sections.push('')

    // File tree
    sections.push(`### File Tree`)
    sections.push('```')
    sections.push(context.fileTree)
    sections.push('```')
    sections.push('')

    // Key files
    sections.push(`### Key Files (${context.keyFiles.length})`)
    for (const file of context.keyFiles) {
        sections.push(`\n#### ${file.relativePath}`)
        sections.push('```')
        sections.push(file.content)
        sections.push('```')
    }

    return sections.join('\n')
}
