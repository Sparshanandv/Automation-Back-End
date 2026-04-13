import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { User } from './user.model'

const SALT_ROUNDS = 10

export async function signup(email: string, password: string) {
  const existing = await User.findOne({ email })
  if (existing) throw new Error('Email already in use')

  const password_hash = await bcrypt.hash(password, SALT_ROUNDS)
  const user = await User.create({ email, password_hash })
  return buildTokenResponse(user)
}

export async function login(email: string, password: string) {
  const user = await User.findOne({ email })
  if (!user) throw new Error('Invalid credentials')

  const valid = await bcrypt.compare(password, user.password_hash as string)
  if (!valid) throw new Error('Invalid credentials')

  return buildTokenResponse(user)
}

export function refreshTokens(refreshToken: string) {
  const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as jwt.JwtPayload
  return {
    access_token: jwt.sign(
      { sub: payload.sub, email: payload.email },
      process.env.JWT_SECRET!,
      { expiresIn: '15m' }
    ),
  }
}

function buildTokenResponse(user: InstanceType<typeof User>) {
  const id = String(user._id)
  const payload = { sub: id, email: user.email }
  return {
    access_token: jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '15m' }),
    refresh_token: jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, { expiresIn: '7d' }),
    user: { id, email: user.email },
  }
}
