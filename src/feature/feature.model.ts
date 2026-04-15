import mongoose, { Schema, Document } from 'mongoose'

export type FeatureStatus =
    | 'CREATED'
    | 'QA'
    | 'QA_APPROVED'
    | 'DEV'
    | 'PLAN_APPROVED'
    | 'CODE_GEN'
    | 'PR_CREATED'
    | 'DONE'

export const FeatureStatusEnum = {
    CREATED: 'CREATED',
    QA: 'QA',
    QA_APPROVED: 'QA_APPROVED',
    DEV: 'DEV',
    PLAN_APPROVED: 'PLAN_APPROVED',
    CODE_GEN: 'CODE_GEN',
    PR_CREATED: 'PR_CREATED',
    DONE: 'DONE',
} as const satisfies Record<string, FeatureStatus>

export const FEATURE_STATUSES: FeatureStatus[] = Object.values(FeatureStatusEnum)

export interface IStatusHistoryEntry {
    status: FeatureStatus
    changedBy: { id: string; email: string }
    changedAt: Date
}

export interface IFeature extends Document {
    featureKey: string
    title: string
    description: string
    criteria: string
    status: FeatureStatus
    statusHistory: IStatusHistoryEntry[]
    projectId?: mongoose.Types.ObjectId
}

const statusHistorySchema = new Schema<IStatusHistoryEntry>(
    {
        status: { type: String, enum: FEATURE_STATUSES, required: true },
        changedBy: {
            id: { type: String, required: true },
            email: { type: String, required: true },
        },
        changedAt: { type: Date, default: () => new Date() },
    },
    { _id: false }
)

const featureSchema = new Schema<IFeature>(
    {
        featureKey: { type: String, unique: true, sparse: true },
        title: { type: String, required: true, trim: true },
        description: { type: String, required: true },
        criteria: { type: String, required: true },
        status: { type: String, enum: FEATURE_STATUSES, default: FeatureStatusEnum.CREATED },
        statusHistory: { type: [statusHistorySchema], default: [] },
        projectId: { type: Schema.Types.ObjectId, ref: 'Project', default: null },
    },
    {
        timestamps: true,
        toJSON: {
            virtuals: true,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            transform: (_: any, ret: any) => {
                delete ret._id
                delete ret.__v
                return ret
            },
        },
    }
)

export const Feature = mongoose.model<IFeature>('Feature', featureSchema)
