import { Router } from 'express'
import { AuthRequest } from '../common/middleware/auth.middleware'
import { Response } from 'express'

const router = Router()

router.get('/summary', (req: AuthRequest, res: Response) => {
  res.json({
    message: 'Welcome to the AI SDLC Automation platform!',
    user: req.user,
    features: [
      { name: 'AI Test Case Generation', status: 'available' },
      { name: 'AI Dev Plan Generation', status: 'available' },
      { name: 'AI Code Generation', status: 'coming soon' },
      { name: 'GitHub Automation', status: 'coming soon' },
    ],
  })
})

export default router
