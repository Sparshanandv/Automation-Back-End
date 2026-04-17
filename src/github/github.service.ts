import { exec } from 'child_process'
import { mkdir } from 'fs/promises'
import path from 'path'
import { HttpStatus } from '../common/constants/http-status'

export class GithubService {
  private static headers(token: string): Record<string, string> {
    return {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Node.js',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    }
  }

  /**
   * Returns the authenticated GitHub user's profile.
   */
  static async getAuthenticatedUser(token: string): Promise<{ login: string; name: string | null; avatar_url: string }> {
    const response = await fetch('https://api.github.com/user', { headers: this.headers(token) })
    if (!response.ok) {
      const errorBody = await response.json() as any
      throw new Error(`Failed to fetch GitHub user: ${errorBody.message || response.statusText}`)
    }
    const { login, name, avatar_url } = await response.json() as any
    return { login, name, avatar_url }
  }

  /**
   * Returns all repositories accessible by the provided token (up to 100, sorted by updated).
   */
  static async getUserRepos(token: string): Promise<string[]> {
    const response = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', { headers: this.headers(token) })
    if (!response.ok) {
      const errorBody = await response.json() as any
      throw new Error(`Failed to fetch repositories: ${errorBody.message || response.statusText}`)
    }
    const repos = await response.json() as any[]
    return repos.map(r => r.name)
  }

  /**
   * Validates if the token has access to the given repository.
   */
  static async validateRepoAccess(repoName: string, token: string): Promise<boolean> {
    try {
      const response = await fetch(`https://api.github.com/repos/${repoName}`, { headers: this.headers(token) })
      return response.status === HttpStatus.OK
    } catch (error) {
      console.error(`GitHub validation failed for repo: ${repoName}`, error)
      return false
    }
  }

  /**
   * Creates a new repository for the authenticated user and optionally creates a custom branch.
   */
  static async createRepository(token: string, name: string, description: string, isPrivate: boolean, targetBranch: string): Promise<string> {
    const headers = this.headers(token)

    const response = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers,
      body: JSON.stringify({ name, description, private: isPrivate, auto_init: true }),
    })

    if (!response.ok) {
      const errorBody = await response.json() as any
      if (response.status === HttpStatus.UNAUTHORIZED || response.status === HttpStatus.FORBIDDEN) {
        throw new Error('GitHub token does not have adequate permissions to create a repository.')
      }
      throw new Error(`Failed to create repository: ${errorBody.message || response.statusText}`)
    }

    const { full_name, default_branch } = await response.json() as any

    if (targetBranch && targetBranch !== default_branch) {
      const refResponse = await fetch(`https://api.github.com/repos/${full_name}/git/refs/heads/${default_branch}`, { headers })
      if (!refResponse.ok) {
        throw new Error(`Repository created as ${full_name}, but failed to fetch base branch for branching.`)
      }
      const refData = await refResponse.json() as any
      const sha = refData.object.sha

      const createRefResponse = await fetch(`https://api.github.com/repos/${full_name}/git/refs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ref: `refs/heads/${targetBranch}`, sha }),
      })
      if (!createRefResponse.ok) {
        throw new Error(`Repository created as ${full_name}, but failed to create branch ${targetBranch}.`)
      }
    }

    return full_name
  }

  /**
   * Fetches all branches for a given repository.
   */
  static async getBranches(repoName: string, token: string): Promise<string[]> {
    const response = await fetch(`https://api.github.com/repos/${repoName}/branches`, { headers: this.headers(token) })
    if (!response.ok) {
      const errorBody = await response.json() as any
      throw new Error(`Failed to fetch branches: ${errorBody.message || response.statusText}`)
    }
    const branches = await response.json() as any[]
    return branches.map(b => b.name)
  }

  /**
   * Creates a new branch from a parent branch.
   */
  static async createBranch(repoName: string, newBranch: string, fromBranch: string, token: string): Promise<void> {
    const headers = this.headers(token)

    const refResponse = await fetch(`https://api.github.com/repos/${repoName}/git/refs/heads/${fromBranch}`, { headers })
    if (!refResponse.ok) {
      const errorBody = await refResponse.json() as any
      throw new Error(`Failed to fetch base branch reference: ${errorBody.message || refResponse.statusText}`)
    }
    const refData = await refResponse.json() as any
    const sha = refData.object.sha

    const createRefResponse = await fetch(`https://api.github.com/repos/${repoName}/git/refs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ref: `refs/heads/${newBranch}`, sha }),
    })
    if (!createRefResponse.ok) {
      const errorBody = await createRefResponse.json() as any
      throw new Error(`Failed to create branch: ${errorBody.message || createRefResponse.statusText}`)
    }
  }

  /**
   * Deletes a repository.
   */
  static async deleteRepository(fullName: string, token: string): Promise<void> {
    const response = await fetch(`https://api.github.com/repos/${fullName}`, {
      method: 'DELETE',
      headers: this.headers(token),
    })
    if (!response.ok) {
      throw new Error(`GitHub delete failed: ${response.statusText}`)
    }
  }

  /**
   * Deletes a branch from a repository.
   */
  static async deleteBranch(repoName: string, branchName: string, token: string): Promise<void> {
    const response = await fetch(`https://api.github.com/repos/${repoName}/git/refs/heads/${branchName}`, {
      method: 'DELETE',
      headers: this.headers(token),
    })
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({})) as any
      throw new Error(`Failed to delete branch: ${errorBody.message || response.statusText}`)
    }
  }

  /**
   * Clones a GitHub repository to a local path.
   * Path format: LOCAL_REPO_PATH/projectName/repoName
   */
  static async cloneRepository(repoFullName: string, localPath: string, token?: string): Promise<void> {
    const { existsSync } = await import('fs')

    if (existsSync(localPath)) {
      console.log(`[git clone] Skipping — directory already exists: ${localPath}`)
      return
    }

    await mkdir(path.dirname(localPath), { recursive: true })

    const cloneUrl = token
      ? `https://${token}@github.com/${repoFullName}.git`
      : `https://github.com/${repoFullName}.git`

    const safeLogUrl = `https://***@github.com/${repoFullName}.git`
    console.log(`[git clone] Starting: ${safeLogUrl} → ${localPath}`)

    await new Promise<void>((resolve, reject) => {
      exec(`/usr/bin/git clone "${cloneUrl}" "${localPath}"`, { timeout: 120000 }, (error, stdout, stderr) => {
        if (error) {
          console.error(`[git clone] Failed: ${error.message}`)
          console.error(`[git clone] stderr: ${stderr}`)
          reject(error)
        } else {
          console.log(`[git clone] Success: ${localPath}`)
          resolve()
        }
      })
    })
  }

  /**
   * Creates a branch and pushes files to it, then opens a PR — all via GitHub API (no local git needed).
   */
  static async pushFilesAndCreatePR(
    repoName: string,
    branchName: string,
    files: Array<{ path: string; content: string }>,
    prTitle: string,
    prBody: string,
    baseBranch: string,
    token: string
  ): Promise<{ prUrl: string; prNumber: number }> {
    const headers = this.headers(token)

    // 1. Get base branch SHA
    const refRes = await fetch(`https://api.github.com/repos/${repoName}/git/refs/heads/${baseBranch}`, { headers })
    if (!refRes.ok) {
      const err = await refRes.json() as any
      throw new Error(`Failed to get base branch ref: ${err.message || refRes.statusText}`)
    }
    const baseSha: string = ((await refRes.json()) as any).object.sha

    // 2. Create the feature branch (ignore 422 = already exists)
    const createBranchRes = await fetch(`https://api.github.com/repos/${repoName}/git/refs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: baseSha }),
    })
    if (!createBranchRes.ok && createBranchRes.status !== 422) {
      const err = await createBranchRes.json() as any
      throw new Error(`Failed to create branch: ${err.message || createBranchRes.statusText}`)
    }

    // 3. Push each file via Contents API
    for (const file of files) {
      if (!file.path || !file.content) continue
      const encodedContent = Buffer.from(file.content, 'utf-8').toString('base64')

      // Check if file already exists to get its SHA (needed for updates)
      let existingSha: string | undefined
      const existingRes = await fetch(
        `https://api.github.com/repos/${repoName}/contents/${file.path}?ref=${branchName}`,
        { headers }
      )
      if (existingRes.ok) {
        existingSha = ((await existingRes.json()) as any).sha
      }

      const putRes = await fetch(`https://api.github.com/repos/${repoName}/contents/${file.path}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          message: `feat: add ${file.path}`,
          content: encodedContent,
          branch: branchName,
          ...(existingSha && { sha: existingSha }),
        }),
      })
      if (!putRes.ok) {
        const err = await putRes.json() as any
        throw new Error(`Failed to push file ${file.path}: ${err.message || putRes.statusText}`)
      }
    }

    // 4. Create Pull Request
    const prRes = await fetch(`https://api.github.com/repos/${repoName}/pulls`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: prTitle, body: prBody, head: branchName, base: baseBranch }),
    })
    if (!prRes.ok) {
      const err = await prRes.json() as any
      throw new Error(`Failed to create PR: ${err.message || prRes.statusText}`)
    }
    const pr = await prRes.json() as any
    return { prUrl: pr.html_url, prNumber: pr.number }
  }

  static async updateReadme(
    repoName: string,
    branch: string,
    content: string,
    message: string,
    token: string
  ): Promise<void> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Node.js',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    }

    const readmePath = 'README.md'

    let sha: string | undefined

    const getResponse = await fetch(
      `https://api.github.com/repos/${repoName}/contents/${readmePath}?ref=${branch}`,
      { headers }
    )

    if (getResponse.ok) {
      const data = (await getResponse.json()) as any
      sha = data.sha
    } else if (getResponse.status !== HttpStatus.NOT_FOUND) {
      const err = (await getResponse.json().catch(() => ({}))) as any
      throw new Error(`Failed to fetch README: ${err.message || getResponse.statusText}`)
    }

    const encodedContent = Buffer.from(content, 'utf-8').toString('base64')

    const updateResponse = await fetch(`https://api.github.com/repos/${repoName}/contents/${readmePath}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message,
        content: encodedContent,
        branch,
        ...(sha && { sha }),
      }),
    })

    if (!updateResponse.ok) {
      const err = (await updateResponse.json().catch(() => ({}))) as any
      throw new Error(`Failed to update README: ${err.message || updateResponse.statusText}`)
    }
  }
  
}
