export class GithubService {
  /**
   * Validates if the GitHub token has access to the given repository.
   * @param repoName - e.g. "facebook/react"
   */
  static async validateRepoAccess(repoName: string): Promise<boolean> {
    const token = process.env.GITHUB_TOKEN;

    try {
      const headers: Record<string, string> = {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Node.js",
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(`https://api.github.com/repos/${repoName}`, {
        headers,
      });
      return response.status === 200;
    } catch (error) {
      console.error(`GitHub validation failed for repo: ${repoName}`, error);
      return false;
    }
  }

  /**
   * Creates a new repository for the authenticated user and optionally generates a branch.
   */
  static async createRepository(
    name: string,
    description: string,
    isPrivate: boolean,
    targetBranch: string,
  ): Promise<string> {
    const token = process.env.GITHUB_TOKEN;
    if (!token)
      throw new Error(
        "GITHUB_TOKEN is not configured in the server environment.",
      );

    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "Node.js",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    // 1. Create the repository
    const response = await fetch("https://api.github.com/user/repos", {
      method: "POST",
      headers,
      body: JSON.stringify({
        name,
        description,
        private: isPrivate,
        auto_init: true, // Generate the initial commit on main
      }),
    });

    if (!response.ok) {
      const errorBody = (await response.json()) as any;
      if (response.status === 401 || response.status === 403) {
        throw new Error(
          "GitHub token does not have adequate permissions to create a repository.",
        );
      }
      throw new Error(
        `Failed to create repository: ${errorBody.message || response.statusText}`,
      );
    }

    const { full_name, default_branch } = (await response.json()) as any;

    // 2. Generate custom branch if it differs from default
    if (targetBranch && targetBranch !== default_branch) {
      // 2a. Fetch the SHA of the generated default branch
      const refResponse = await fetch(
        `https://api.github.com/repos/${full_name}/git/refs/heads/${default_branch}`,
        { headers },
      );
      if (!refResponse.ok) {
        throw new Error(
          `Repository created as ${full_name}, but failed to fetch base branch for branching.`,
        );
      }
      const refData = (await refResponse.json()) as any;
      const sha = refData.object.sha;

      // 2b. Create the new branch reference
      const createRefResponse = await fetch(
        `https://api.github.com/repos/${full_name}/git/refs`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            ref: `refs/heads/${targetBranch}`,
            sha,
          }),
        },
      );

      if (!createRefResponse.ok) {
        throw new Error(
          `Repository created as ${full_name}, but failed to create branch ${targetBranch}.`,
        );
      }
    }

    return full_name;
  }

  /**
   * Commit multiple files to a branch (default: creates feature-branch from main)
   * @param repoName - e.g. "user/repo"
   * @param files - Array of { path: string, content: string }
   * @param commitMessage - Commit message
   * @param sourceBranch - Branch to create commit on (default: 'feature-branch')
   * @param baseBranch - Base branch to create feature branch from (default: 'main')
   */
  static async commitFiles(
    repoName: string,
    files: Array<{ path: string; content: string }>,
    commitMessage: string,
    sourceBranch: string = "feature-branch",
    baseBranch: string = "main",
  ): Promise<{ commitSha: string; branch: string }> {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GITHUB_TOKEN is not configured.");

    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "Node.js",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    try {
      // 1. Get the base branch (main) commit SHA
      const baseRefResponse = await fetch(
        `https://api.github.com/repos/${repoName}/git/refs/heads/${baseBranch}`,
        { headers },
      );
      if (!baseRefResponse.ok)
        throw new Error(`Base branch '${baseBranch}' not found`);
      const baseRefData = (await baseRefResponse.json()) as any;
      const baseSha = baseRefData.object.sha;

      // 2. Create feature branch if it doesn't exist
      const featureBranchResponse = await fetch(
        `https://api.github.com/repos/${repoName}/git/refs/heads/${sourceBranch}`,
        { headers },
      );

      let currentSha = baseSha;
      if (!featureBranchResponse.ok) {
        // Create feature branch
        const createBranchResponse = await fetch(
          `https://api.github.com/repos/${repoName}/git/refs`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              ref: `refs/heads/${sourceBranch}`,
              sha: baseSha,
            }),
          },
        );
        if (!createBranchResponse.ok) {
          const err = (await createBranchResponse.json()) as any;
          throw new Error(`Failed to create branch: ${err.message}`);
        }
      } else {
        const featureRefData = (await featureBranchResponse.json()) as any;
        currentSha = featureRefData.object.sha;
      }

      // 3. Get the commit tree SHA
      const commitResponse = await fetch(
        `https://api.github.com/repos/${repoName}/git/commits/${currentSha}`,
        { headers },
      );
      if (!commitResponse.ok)
        throw new Error(`Failed to fetch commit: ${currentSha}`);
      const commitData = (await commitResponse.json()) as any;
      const baseTreeSha = commitData.tree.sha;

      // 4. Create blobs for each file
      const blobs: Array<{ path: string; sha: string }> = [];
      for (const file of files) {
        const blobResponse = await fetch(
          `https://api.github.com/repos/${repoName}/git/blobs`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              content: file.content,
              encoding: "utf-8",
            }),
          },
        );
        if (!blobResponse.ok)
          throw new Error(`Failed to create blob for ${file.path}`);
        const blobData = (await blobResponse.json()) as any;
        blobs.push({ path: file.path, sha: blobData.sha });
      }

      // 5. Create a new tree with all blobs
      const treeItems = blobs.map((blob) => ({
        path: blob.path,
        mode: "100644",
        type: "blob",
        sha: blob.sha,
      }));

      const treeResponse = await fetch(
        `https://api.github.com/repos/${repoName}/git/trees`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            base_tree: baseTreeSha,
            tree: treeItems,
          }),
        },
      );
      if (!treeResponse.ok) throw new Error("Failed to create tree");
      const treeData = (await treeResponse.json()) as any;

      // 6. Create a new commit
      const newCommitResponse = await fetch(
        `https://api.github.com/repos/${repoName}/git/commits`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            message: commitMessage,
            tree: treeData.sha,
            parents: [currentSha],
          }),
        },
      );
      if (!newCommitResponse.ok) throw new Error("Failed to create commit");
      const newCommitData = (await newCommitResponse.json()) as any;

      // 7. Update the branch reference to point to the new commit
      const updateRefResponse = await fetch(
        `https://api.github.com/repos/${repoName}/git/refs/heads/${sourceBranch}`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            sha: newCommitData.sha,
            force: false,
          }),
        },
      );
      if (!updateRefResponse.ok)
        throw new Error("Failed to update branch reference");

      return {
        commitSha: newCommitData.sha,
        branch: sourceBranch,
      };
    } catch (error) {
      console.error("commitFiles error:", error);
      throw error;
    }
  }

  /**
   * Push feature branch to GitHub (makes it available for PR)
   * This simply ensures the feature branch is on GitHub - doesn't merge to main
   * @param repoName - e.g. "user/repo"
   * @param sourceBranch - Feature branch to push (default: 'feature-branch')
   */
  static async pushCode(
    repoName: string,
    sourceBranch: string = "feature-branch",
  ): Promise<{ commit: string; branch: string }> {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GITHUB_TOKEN is not configured.");

    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "Node.js",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    try {
      // Verify the source branch exists on GitHub
      const sourceRefResponse = await fetch(
        `https://api.github.com/repos/${repoName}/git/refs/heads/${sourceBranch}`,
        { headers },
      );
      if (!sourceRefResponse.ok)
        throw new Error(
          `Source branch '${sourceBranch}' not found on GitHub. Make sure commits were created first.`,
        );
      const sourceRefData = (await sourceRefResponse.json()) as any;
      const sourceSha = sourceRefData.object.sha;

      // Branch is already on GitHub (from commitFiles), just return its info
      return {
        commit: sourceSha,
        branch: sourceBranch,
      };
    } catch (error) {
      console.error("pushCode error:", error);
      throw error;
    }
  }

  /**
   * Create a Pull Request from feature branch to main
   * @param repoName - e.g. "user/repo"
   * @param title - PR title
   * @param body - PR description
   * @param sourceBranch - Feature branch (default: 'feature-branch')
   * @param targetBranch - Target branch (default: 'main')
   */
  static async createPullRequest(
    repoName: string,
    title: string,
    body: string,
    sourceBranch: string = "feature-branch",
    targetBranch: string = "main",
  ): Promise<{ prNumber: number; prUrl: string }> {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GITHUB_TOKEN is not configured.");

    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "Node.js",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    try {
      const prResponse = await fetch(
        `https://api.github.com/repos/${repoName}/pulls`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            title,
            body,
            head: sourceBranch,
            base: targetBranch,
            draft: false,
          }),
        },
      );

      console.log("createPullRequest response status:", prResponse);

      if (!prResponse.ok) {
        const err = (await prResponse.json()) as any;
        throw new Error(`Failed to create PR: ${err.message}`);
      }

      const prData = (await prResponse.json()) as any;
      return {
        prNumber: prData.number,
        prUrl: prData.html_url,
      };
    } catch (error) {
      console.error("createPullRequest error:", error);
      throw error;
    }
  }

  /**
   * Assign reviewers to a Pull Request
   * @param repoName - e.g. "user/repo"
   * @param prNumber - PR number
   * @param reviewers - Array of GitHub usernames
   */
  static async assignReviewers(
    repoName: string,
    prNumber: number,
    reviewers: string[],
  ): Promise<{ reviewers: string[] }> {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GITHUB_TOKEN is not configured.");

    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "Node.js",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    try {
      const assignResponse = await fetch(
        `https://api.github.com/repos/${repoName}/pulls/${prNumber}/requested_reviewers`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            reviewers,
          }),
        },
      );

      if (!assignResponse.ok) {
        const err = (await assignResponse.json()) as any;
        throw new Error(`Failed to assign reviewers: ${err.message}`);
      }

      return { reviewers };
    } catch (error) {
      console.error("assignReviewers error:", error);
      throw error;
    }
  }
}
