import { Request, Response } from 'express'
import { HttpStatus } from '../common/constants/http-status'

export function getHello(req: Request, res: Response) {
  res.status(HttpStatus.OK).json({ message: 'Hello World' })
}
