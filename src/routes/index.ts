import { Express, Router } from 'express'
import { authMiddleware } from '../common/middleware/auth.middleware'
import authRouter from '../auth/auth.router'
import demoRouter from '../demo/demo.router'
import projectRouter from '../project/project.router'
import githubRouter from '../github/github.router'
import featureRouter from '../feature/feature.router'
import aiRouter from '../ai/ai.router'
import helloRouter from '../hello/hello.router'

interface RouteDefinition {
  path: string
  router: Router
  isPublic: boolean
}

const routes: RouteDefinition[] = [
  { path: '/auth',     router: authRouter,    isPublic: true  },
  { path: '/demo',     router: demoRouter,    isPublic: false },
  { path: '/projects', router: projectRouter, isPublic: false },
  { path: '/github',   router: githubRouter,  isPublic: false },
  { path: '/features', router: featureRouter, isPublic: false },
  { path: '/ai',       router: aiRouter,      isPublic: false },
]

export function registerRoutes(app: Express) {
  for (const route of routes) {
    if (route.isPublic) {
      app.use(`/api${route.path}`, route.router)
    } else {
      app.use(`/api${route.path}`, authMiddleware, route.router)
    }
  }
}