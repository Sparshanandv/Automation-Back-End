import mongoose, { Schema, Document } from 'mongoose'

export interface IPullRequest extends Document {
    feature_id: mongoose.Types.ObjectId
    pr_number: number
    pr_url: string
    branch_name: string
    status: 'open' | 'closed' | 'merged'
    title: string
    description: string
    repository: {
        owner: string
        name: string
    }
    createdAt: Date
    updatedAt: Date
}

const pullRequestSchema = new Schema<IPullRequest>(
    {
        feature_id: {
            type: Schema.Types.ObjectId,
            ref: 'Feature',
            required: true,
            unique: true,
        },
        pr_number: { type: Number, required: true },
        pr_url: { type: String, required: true },
        branch_name: { type: String, required: true },
        status: {
            type: String,
            enum: ['open', 'closed', 'merged'],
            default: 'open',
            required: true,
        },
        title: { type: String, required: true },
        description: { type: String, default: '' },
        repository: {
            owner: { type: String, required: true },
            name: { type: String, required: true },
        },
    },
    { timestamps: true }
)

export const PullRequest = mongoose.model<IPullRequest>('PullRequest', pullRequestSchema)
