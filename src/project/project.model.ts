import mongoose, { Types } from 'mongoose'

const repositorySchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    repo_name: { type: String, required: true, trim: true },
    branch: { type: String, required: true, trim: true },
    purpose: { type: String, enum: ['FE', 'BE', 'Infra'], required: true },
  },
  { timestamps: true }
)

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    githubToken: { type: String, trim: true },
    createdByEmail: { type: String, trim: true },
  },
  { timestamps: true }
)

export const Repository = mongoose.model('Repository', repositorySchema)
export const Project = mongoose.model('Project', projectSchema)
