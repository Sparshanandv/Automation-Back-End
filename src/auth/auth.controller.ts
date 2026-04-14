import { Request, Response } from 'express'
import * as authService from './auth.service'
import { HttpStatus } from '../common/constants/http-status'

export async function signup(req: Request, res: Response) {
  const { email, password } = req.body
  if (!email || !password) {
    res.status(HttpStatus.BAD_REQUEST).json({ message: 'Email and password are required' })
    return
  }
  try {
    const result = await authService.signup(email, password)
    res.status(HttpStatus.CREATED).json(result)
  } catch (err: unknown) {
    res.status(HttpStatus.BAD_REQUEST).json({ message: (err as Error).message })
  }
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body
  if (!email || !password) {
    res.status(HttpStatus.BAD_REQUEST).json({ message: 'Email and password are required' })
    return
  }
  try {
    const result = await authService.login(email, password)
    res.json(result)
  } catch (err: unknown) {
    res.status(HttpStatus.UNAUTHORIZED).json({ message: (err as Error).message })
  }
}

export function refresh(req: Request, res: Response) {
  const { refresh_token } = req.body
  if (!refresh_token) {
    res.status(HttpStatus.BAD_REQUEST).json({ message: 'refresh_token is required' })
    return
  }
  try {
    const result = authService.refreshTokens(refresh_token)
    res.json(result)
  } catch {
    res.status(HttpStatus.UNAUTHORIZED).json({ message: 'Invalid or expired refresh token' })
  }
}
