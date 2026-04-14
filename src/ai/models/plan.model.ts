import mongoose from 'mongoose'

const planSchema = new mongoose.Schema(
    {
        feature_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Feature', required: true, unique: true },
        content: { type: String, required: true },
        refinements: { type: [String], default: [] },
    },
    { timestamps: true }
)

export const Plan = mongoose.model('Plan', planSchema)
