import { Request, Response } from 'express'
import * as messageService from './message.service'
import { HttpStatus } from '../common/constants/http-status'

export async function getMessageHandler(req: Request, res: Response) {
  const { key } = req.params
  if (!key) {
    res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: 'Message key is required' })
    return
  }
  try {
    const message = await messageService.getMessageByKey(key)
    if (!message) {
      res.status(HttpStatus.NOT_FOUND).json({ success: false, message: 'Message not found' })
      return
    }
    res.json({ success: true, data: message })
  } catch (err: unknown) {
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: (err as Error).message })
  }
}

export async function createMessageHandler(req: Request, res: Response) {
  const { key, content, isActive, metadata } = req.body
  if (!key || !content) {
    res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: 'key and content are required' })
    return
  }
  try {
    const message = await messageService.createMessage({ key, content, isActive, metadata })
    res.status(HttpStatus.CREATED).json({ success: true, data: message })
  } catch (err: unknown) {
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: (err as Error).message })
  }
}
