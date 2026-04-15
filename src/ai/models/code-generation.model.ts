import mongoose, { Schema, Document } from 'mongoose'

export interface ICodeGeneration extends Document {
    feature_id: mongoose.Types.ObjectId
    result: {
        filesWritten: string[]
        summary: string
    }
    sessionId: string
    createdAt: Date
    updatedAt: Date
}

const codeGenerationSchema = new Schema<ICodeGeneration>(
    {
        feature_id: {
            type: Schema.Types.ObjectId,
            ref: 'Feature',
            required: true,
            unique: true,
        },
        result: {
            filesWritten: { type: [String], default: [] },
            summary: { type: String, default: '' },
        },
        sessionId: { type: String, required: true },
    },
    { timestamps: true }
)

export const CodeGeneration = mongoose.model<ICodeGeneration>('CodeGeneration', codeGenerationSchema)
