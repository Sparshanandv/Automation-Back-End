import { Request, Response } from 'express'
import { HttpStatus } from '../constants/http-status'

export function notFoundMiddleware(req: Request, res: Response) {
  res.status(HttpStatus.NOT_FOUND).json({ message: `Route ${req.method} ${req.path} not found` })
}
