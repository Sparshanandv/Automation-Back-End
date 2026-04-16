import { Feature, FeatureStatus, FeatureStatusEnum } from "./feature.model";
import { isValidTransition } from "./feature.state-machine";
import { Project, Repository } from "../project/project.model";
import { GithubService } from "../github/github.service";

interface Actor {
  id: string;
  email: string;
}

async function generateFeatureKey(projectId?: string): Promise<string> {
  if (projectId) {
    const project = await Project.findById(projectId)
    if (!project) return `TASK-${Date.now()}`

    let currentCounter = project.featureCounter || 0

    // Initialization for existing projects that don't have a counter yet
    if (currentCounter === 0) {
      const existingFeatures = await Feature.find({ projectId }).select('featureKey').lean()
      const prefix = project.projectKey || 'TASK'
      const prefixDash = `${prefix}-`
      
      let maxNum = 0
      existingFeatures.forEach(f => {
        if (f.featureKey && f.featureKey.startsWith(prefixDash)) {
          const num = parseInt(f.featureKey.slice(prefixDash.length), 10)
          if (!isNaN(num) && num > maxNum) maxNum = num
        }
      })
      currentCounter = maxNum
    }

    const updatedProject = await Project.findByIdAndUpdate(
      projectId,
      { $set: { featureCounter: currentCounter + 1 } },
      { new: true }
    )

    const prefix = updatedProject?.projectKey || project.projectKey || 'TASK'
    return `${prefix}-${currentCounter + 1}`


  }
  // For global tasks (projectId null), find the max numeric suffix among existing TASK-N keys
  const features = await Feature.find({ projectId: null }).select('featureKey').lean()
  let maxNum = 0
  features.forEach(f => {
    if (f.featureKey && f.featureKey.startsWith('TASK-')) {
      const num = parseInt(f.featureKey.split('-')[1], 10)
      if (!isNaN(num) && num > maxNum) maxNum = num
    }
  })
  
  return `TASK-${maxNum + 1}`
}

function buildBranchName(type: string, featureKey: string, projectName: string): string {
  const sanitizedProject = projectName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const sanitizedKey = featureKey.toLowerCase()
  return `${type}/${sanitizedKey}-${sanitizedProject}`
}

async function createBranchesForCodeGen(
  projectId: string,
  type: string,
  featureKey: string,
): Promise<void> {
  const project = await Project.findById(projectId)
  if (!project?.githubToken) return

  const repos = await Repository.find({ projectId })
  if (repos.length === 0) return

  const branchName = buildBranchName(type, featureKey, project.name)

  const results = await Promise.allSettled(
    repos.map(repo =>
      GithubService.createBranch(repo.repo_name, branchName, repo.branch, project.githubToken!)
    )
  )

  const failures = results
    .map((r, i) => r.status === 'rejected' ? `${repos[i].repo_name}: ${(r as PromiseRejectedResult).reason?.message}` : null)
    .filter(Boolean)

  if (failures.length > 0) {
    throw Object.assign(
      new Error(`Branch creation failed for: ${failures.join('; ')}`),
      { status: 502 }
    )
  }
}

export const featureService = {
  async create(title: string, description: string, criteria: string, actor: Actor, type: string, projectId?: string) {
    const featureKey = await generateFeatureKey(projectId)
    const feature = new Feature({
      featureKey,
      title,
      description,
      criteria,
      type,
      status: FeatureStatusEnum.CREATED,
      createdBy: actor,
      statusHistory: [{ status: FeatureStatusEnum.CREATED, changedBy: actor, changedAt: new Date() }],
      ...(projectId && { projectId }),
    });
    return feature.save();
  },

  async getById(id: string) {
    const feature = await Feature.findById(id);
    if (!feature)
      throw Object.assign(new Error("Feature not found"), { status: 404 });
    return feature;
  },

  async listAll() {
    return Feature.find().sort({ createdAt: -1 });
  },

  async listByProject(projectId: string) {
    return Feature.find({ projectId }).sort({ createdAt: -1 });
  },

  async updateStatus(id: string, to: FeatureStatus, actor: Actor) {
    const feature = await featureService.getById(id);
    if (!isValidTransition(feature.status as FeatureStatus, to)) {
      throw Object.assign(
        new Error(
          `Invalid transition: ${feature.status} → ${to}. Only the next sequential status is allowed.`,
        ),
        { status: 400 },
      );
    }
    // Auto-create branches on PLAN_APPROVED → CODE_GEN
    if (to === FeatureStatusEnum.CODE_GEN && feature.projectId) {
      await createBranchesForCodeGen(
        feature.projectId.toString(),
        feature.type || 'task',
        feature.featureKey,
      )
    }

    feature.status = to;
    feature.statusHistory.push({
      status: to,
      changedBy: actor,
      changedAt: new Date(),
    });
    return feature.save();
  },

  async update(
    id: string,
    updates: {
      title?: string;
      description?: string;
      criteria?: string;
    },
  ) {
    const feature = await featureService.getById(id);

    // Only allow editing if status is CREATED
    if (feature.status !== FeatureStatusEnum.CREATED) {
      throw Object.assign(
        new Error(
          `Can only edit features in CREATED status. Current status: ${feature.status}`,
        ),
        { status: 400 },
      );
    }

    if (updates.title !== undefined) feature.title = updates.title;
    if (updates.description !== undefined)
      feature.description = updates.description;
    if (updates.criteria !== undefined) feature.criteria = updates.criteria;

    return feature.save();
  },

  //delete task
  async delete(id: string) {
    const feature = await Feature.findById(id);
    if (!feature) {
      throw Object.assign(new Error("Feature not found"), { status: 404 });
    }

    await Feature.findByIdAndDelete(id);
    return { message: "Feature deleted successfully" };
  },
};
