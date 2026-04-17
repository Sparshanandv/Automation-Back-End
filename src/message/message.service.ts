import { Message, IMessage } from './message.model'

export async function getMessageByKey(key: string): Promise<IMessage | null> {
  return Message.findOne({ key, isActive: true })
}

export async function createMessage(data: {
  key: string
  content: string
  isActive?: boolean
  metadata?: Record<string, unknown>
}): Promise<IMessage> {
  return Message.findOneAndUpdate(
    { key: data.key },
    {
      $set: {
        content: data.content,
        isActive: data.isActive ?? true,
        metadata: data.metadata ?? {},
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ) as Promise<IMessage>
}

export async function updateMessage(
  key: string,
  data: Partial<{ content: string; isActive: boolean; metadata: Record<string, unknown> }>
): Promise<IMessage | null> {
  return Message.findOneAndUpdate({ key }, { $set: data }, { new: true })
}
