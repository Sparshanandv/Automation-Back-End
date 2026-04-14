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
      
      if (token) {
        headers.Authorization = `Bearer ${token}`
      }

      const response = await fetch(`https://api.github.com/repos/${repoName}`, {
        headers,
      })

      return response.status === 200
    } catch (error) {
      console.error(`GitHub validation failed for repo: ${repoName}`, error)
      return false
    }
  }
}
