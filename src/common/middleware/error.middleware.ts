import { Request, Response, NextFunction } from 'express'
import { HttpStatus } from '../constants/http-status'

export function errorMiddleware(
  err: Error & { status?: number },
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  const status = err.status ?? HttpStatus.INTERNAL_SERVER_ERROR
  const message = status === HttpStatus.INTERNAL_SERVER_ERROR ? 'Internal server error' : err.message
  if (status === HttpStatus.INTERNAL_SERVER_ERROR) console.error(err)
  res.status(status).json({ message })
}
