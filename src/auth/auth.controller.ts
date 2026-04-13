import { Request, Response } from 'express'
import * as authService from './auth.service'

export async function signup(req: Request, res: Response) {
  const { email, password } = req.body
  if (!email || !password) {
    res.status(400).json({ message: 'Email and password are required' })
    return
  }
  try {
    const result = await authService.signup(email, password)
    res.status(201).json(result)
  } catch (err: unknown) {
    res.status(400).json({ message: (err as Error).message })
  }
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body
  if (!email || !password) {
    res.status(400).json({ message: 'Email and password are required' })
    return
  }
  try {
    const result = await authService.login(email, password)
    res.json(result)
  } catch (err: unknown) {
    res.status(401).json({ message: (err as Error).message })
  }
}

export function refresh(req: Request, res: Response) {
  const { refresh_token } = req.body
  if (!refresh_token) {
    res.status(400).json({ message: 'refresh_token is required' })
    return
  }
  try {
    const result = authService.refreshTokens(refresh_token)
    res.json(result)
  } catch {
    res.status(401).json({ message: 'Invalid or expired refresh token' })
  }
}
