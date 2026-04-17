import mongoose from 'mongoose'

export type PlanStatus = 'pending' | 'running' | 'completed' | 'failed'

const planSchema = new mongoose.Schema(
    {
        feature_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Feature', required: true, unique: true },
        status: {
            type: String,
            enum: ['pending', 'running', 'completed', 'failed'],
            default: 'pending',
        },
        content: { type: String, default: '' },
        error: { type: String },
        refinements: { type: [String], default: [] },
    },
    { timestamps: true }
)

export const Plan = mongoose.model('Plan', planSchema)
