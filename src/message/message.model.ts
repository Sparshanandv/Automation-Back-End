import mongoose, { Schema, Document } from 'mongoose'

export interface IMessage extends Document {
  key: string
  content: string
  isActive: boolean
  metadata: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

const messageSchema = new Schema<IMessage>(
  {
    key: { type: String, required: true, unique: true, index: true },
    content: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
)

messageSchema.index({ isActive: 1, key: 1 })

export const Message = mongoose.model<IMessage>('Message', messageSchema)
