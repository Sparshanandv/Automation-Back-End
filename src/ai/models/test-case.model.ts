import mongoose from 'mongoose'

const testCaseSchema = new mongoose.Schema(
    {
        feature_id: { type: String, required: true },
        content: { type: mongoose.Schema.Types.Mixed, required: true },
    },
    { timestamps: true }
)

export const TestCase = mongoose.model('TestCase', testCaseSchema)
