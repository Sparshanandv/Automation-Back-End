import { Request, Response, NextFunction } from 'express'

export function errorMiddleware(
  err: Error & { status?: number },
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  const status = err.status ?? 500
  const message = status === 500 ? 'Internal server error' : err.message
  if (status === 500) console.error(err)
  res.status(status).json({ message })
}
