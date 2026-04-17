import mongoose, { Schema, Document } from 'mongoose'

export type CodeGenStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface ICodeGeneration extends Document {
    feature_id: mongoose.Types.ObjectId
    status: CodeGenStatus
    result: {
        filesWritten: string[]
        summary: string
    }
    error?: string
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
        status: {
            type: String,
            enum: ['pending', 'running', 'completed', 'failed'],
            default: 'pending',
        },
        result: {
            filesWritten: { type: [String], default: [] },
            summary: { type: String, default: '' },
        },
        error: { type: String },
        sessionId: { type: String, default: '' },
    },
    { timestamps: true }
)

export const CodeGeneration = mongoose.model<ICodeGeneration>('CodeGeneration', codeGenerationSchema)
