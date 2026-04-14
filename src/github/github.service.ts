export class GithubService {
  /**
   * Validates if the GitHub token has access to the given repository.
   * @param repoName - e.g. "facebook/react"
   */
  static async validateRepoAccess(repoName: string): Promise<boolean> {
    const token = process.env.GITHUB_TOKEN
    
    try {
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Node.js',
      }
      if (token) headers.Authorization = `Bearer ${token}`

      const response = await fetch(`https://api.github.com/repos/${repoName}`, { headers })
      return response.status === 200
    } catch (error) {
      console.error(`GitHub validation failed for repo: ${repoName}`, error)
      return false
    }
  }

  /**
   * Creates a new repository for the authenticated user and optionally generates a branch.
   */
  static async createRepository(name: string, description: string, isPrivate: boolean, targetBranch: string): Promise<string> {
    const token = process.env.GITHUB_TOKEN
    if (!token) throw new Error('GITHUB_TOKEN is not configured in the server environment.')

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Node.js',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }

    // 1. Create the repository
    const response = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name,
        description,
        private: isPrivate,
        auto_init: true // Generate the initial commit on main
      })
    })

    if (!response.ok) {
      const errorBody = await response.json() as any
      if (response.status === 401 || response.status === 403) {
        throw new Error('GitHub token does not have adequate permissions to create a repository.')
      }
      throw new Error(`Failed to create repository: ${errorBody.message || response.statusText}`)
    }

    const { full_name, default_branch } = await response.json() as any

    // 2. Generate custom branch if it differs from default
    if (targetBranch && targetBranch !== default_branch) {
      // 2a. Fetch the SHA of the generated default branch
      const refResponse = await fetch(`https://api.github.com/repos/${full_name}/git/refs/heads/${default_branch}`, { headers })
      if (!refResponse.ok) {
        throw new Error(`Repository created as ${full_name}, but failed to fetch base branch for branching.`)
      }
      const refData = await refResponse.json() as any
      const sha = refData.object.sha

      // 2b. Create the new branch reference
      const createRefResponse = await fetch(`https://api.github.com/repos/${full_name}/git/refs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ref: `refs/heads/${targetBranch}`,
          sha
        })
      })

      if (!createRefResponse.ok) {
         throw new Error(`Repository created as ${full_name}, but failed to create branch ${targetBranch}.`)
      }
    }

    return full_name
  }

  /**
   * Fetches all branches for a given repository.
   * @param repoName - e.g. "owner/repo"
   */
  static async getBranches(repoName: string): Promise<string[]> {
    const token = process.env.GITHUB_TOKEN
    if (!token) throw new Error('GITHUB_TOKEN is not configured.')

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Node.js',
      Authorization: `Bearer ${token}`
    }

    const response = await fetch(`https://api.github.com/repos/${repoName}/branches`, { headers })
    
    if (!response.ok) {
      const errorBody = await response.json() as any
      throw new Error(`Failed to fetch branches: ${errorBody.message || response.statusText}`)
    }

    const branches = await response.json() as any[]
    return branches.map(b => b.name)
  }

  /**
   * Creates a new branch from a parent branch.
   * @param repoName - e.g. "owner/repo"
   * @param newBranch - Name of the new branch
   * @param fromBranch - Base branch name
   */
  static async createBranch(repoName: string, newBranch: string, fromBranch: string): Promise<void> {
    const token = process.env.GITHUB_TOKEN
    if (!token) throw new Error('GITHUB_TOKEN is not configured.')

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Node.js',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }

    // 1. Get the SHA of the parent branch
    const refResponse = await fetch(`https://api.github.com/repos/${repoName}/git/refs/heads/${fromBranch}`, { headers })
    if (!refResponse.ok) {
      const errorBody = await refResponse.json() as any
      throw new Error(`Failed to fetch base branch reference: ${errorBody.message || refResponse.statusText}`)
    }
    const refData = await refResponse.json() as any
    const sha = refData.object.sha

    // 2. Create the new reference
    const createRefResponse = await fetch(`https://api.github.com/repos/${repoName}/git/refs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ref: `refs/heads/${newBranch}`,
        sha
      })
    })

    if (!createRefResponse.ok) {
      const errorBody = await createRefResponse.json() as any
      throw new Error(`Failed to create branch: ${errorBody.message || createRefResponse.statusText}`)
    }
  }
}
