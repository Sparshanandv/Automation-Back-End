import { Request, Response } from "express";
import { GithubService } from "./github.service";
import { ProjectService } from "../project/project.service";
import { AuthRequest } from "../common/middleware/auth.middleware";

export class GithubController {
  /**
   * POST /api/github/commit
   * Commit multiple files in one commit to a feature branch
   * Body: {
   *   projectId: "...",
   *   repoId?: "..." (if multiple repos, else uses first),
   *   files?: [{ path: "file1.ts", content: "..." }, ...],
   *   commitMessage?: "..." (default: "Commit 10 files"),
   *   sourceBranch?: "feature-branch" (default),
   *   baseBranch?: "main" (default)
   * }
   */

  // this needs to be replaced by the response from the genrated code in the future, for now we just use dummy files and commit message to demonstrate the workflow
  static async commitFiles(req: AuthRequest, res: Response) {
    try {
      const {
        projectId,
        repoId,
        files = [
          { path: "file1.ts", content: 'export const file1 = "content1";' },
          { path: "file2.ts", content: 'export const file2 = "content2";' },
          { path: "file3.ts", content: 'export const file3 = "content3";' },
          { path: "file4.ts", content: 'export const file4 = "content4";' },
          { path: "file5.ts", content: 'export const file5 = "content5";' },
          { path: "file6.ts", content: 'export const file6 = "content6";' },
          { path: "file7.ts", content: 'export const file7 = "content7";' },
          { path: "file8.ts", content: 'export const file8 = "content8";' },
          { path: "file9.ts", content: 'export const file9 = "content9";' },
          { path: "file10.ts", content: 'export const file10 = "content10";' },
        ],
        commitMessage = "Commit 10 files",
        sourceBranch = "feature-branch",
        baseBranch = "main",
      } = req.body;

      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }

      // Fetch repo from database
      const project = await ProjectService.getProjectById(
        projectId,
        req.user?.sub as string,
      );
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const repo = repoId
        ? project.repos.find((r: any) => r._id.toString() === repoId)
        : project.repos[0];
      if (!repo) {
        return res
          .status(404)
          .json({ error: "Repository not found in project" });
      }

      const repoName = repo.repo_name;

      const result = await GithubService.commitFiles(
        repoName,
        files,
        commitMessage,
        sourceBranch,
        baseBranch,
      );

      res.status(201).json({
        message: `Committed ${files.length} files in one commit to ${repoName}`,
        repoName,
        ...result,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/github/push
   * Push feature branch to GitHub (no merge to main - that happens in PR)
   * Workflow: commitFiles → pushCode → createPullRequest
   * Body: {
   *   projectId: "...",
   *   repoId?: "..." (if multiple repos, else uses first),
   *   sourceBranch?: "feature-branch" (default)
   * }
   */
  static async pushCode(req: AuthRequest, res: Response) {
    try {
      const { projectId, repoId, sourceBranch = "feature-branch" } = req.body;

      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }

      // Fetch repo from database
      const project = await ProjectService.getProjectById(
        projectId,
        req.user?.sub as string,
      );
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const repo = repoId
        ? project.repos.find((r: any) => r._id.toString() === repoId)
        : project.repos[0];
      if (!repo) {
        return res
          .status(404)
          .json({ error: "Repository not found in project" });
      }

      const repoName = repo.repo_name;

      const result = await GithubService.pushCode(repoName, sourceBranch);

      res.status(200).json({
        message: `Pushed ${sourceBranch} to GitHub (ready for PR to main)`,
        repoName,
        ...result,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/github/pr
   * Create a Pull Request from feature branch to main
   * Body: {
   *   projectId: "...",
   *   repoId?: "..." (if multiple repos, else uses first),
   *   title: "PR Title",
   *   body?: "PR Description",
   *   sourceBranch?: "feature-branch" (default),
   *   targetBranch?: "main" (default)
   * }
   */
  static async createPullRequest(req: AuthRequest, res: Response) {
    try {
      const {
        projectId,
        repoId,
        title,
        body = "",
        sourceBranch = "feature-branch",
        targetBranch = "main",
      } = req.body;

      if (!projectId || !title) {
        return res
          .status(400)
          .json({ error: "projectId and title are required" });
      }

      // Fetch repo from database
      const project = await ProjectService.getProjectById(
        projectId,
        req.user?.sub as string,
      );
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const repo = repoId
        ? project.repos.find((r: any) => r._id.toString() === repoId)
        : project.repos[0];
      if (!repo) {
        return res
          .status(404)
          .json({ error: "Repository not found in project" });
      }

      const repoName = repo.repo_name;

      const result = await GithubService.createPullRequest(
        repoName,
        title,
        body,
        sourceBranch,
        targetBranch,
      );

      res.status(201).json({
        message: `Pull request created from ${sourceBranch} to ${targetBranch} in ${repoName}`,
        repoName,
        ...result,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/github/assign-reviewers
   * Assign reviewers to a Pull Request
   * Body: {
   *   projectId: "...",
   *   repoId?: "..." (if multiple repos, else uses first),
   *   prNumber: 1,
   *   reviewers?: ["username1", "username2", ...] (default: ["alice", "bob"])
   * }
   */
  static async assignReviewers(req: AuthRequest, res: Response) {
    try {
      const {
        projectId,
        repoId,
        prNumber,
        reviewers = ["alice", "bob"],
      } = req.body;

      if (!projectId || !prNumber) {
        return res
          .status(400)
          .json({ error: "projectId and prNumber are required" });
      }

      // Fetch repo from database
      const project = await ProjectService.getProjectById(
        projectId,
        req.user?.sub as string,
      );
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const repo = repoId
        ? project.repos.find((r: any) => r._id.toString() === repoId)
        : project.repos[0];
      if (!repo) {
        return res
          .status(404)
          .json({ error: "Repository not found in project" });
      }

      const repoName = repo.repo_name;

      const result = await GithubService.assignReviewers(
        repoName,
        prNumber,
        reviewers,
      );

      res.status(200).json({
        message: `Assigned ${reviewers.length} reviewer(s) to PR #${prNumber} in ${repoName}`,
        repoName,
        ...result,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
