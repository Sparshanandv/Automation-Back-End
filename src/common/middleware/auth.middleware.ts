import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { HttpStatus } from '../constants/http-status'

export interface AuthRequest extends Request {
  user?: { sub: string; email: string }
  file?: any
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(HttpStatus.UNAUTHORIZED).json({ message: 'Unauthorized' })
    return
  }

  const token = header.slice(7)
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { sub: string; email: string }
    req.user = payload
    next()
  } catch {
    res.status(HttpStatus.UNAUTHORIZED).json({ message: 'Invalid or expired token' })
  }
}
