import dotenv from 'dotenv'
dotenv.config()

import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import { registerRoutes } from './routes'
import { notFoundMiddleware } from './common/middleware/notFound.middleware'
import { errorMiddleware } from './common/middleware/error.middleware'

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

app.get('/health', (_req, res) => res.json({ status: 'ok' }))
registerRoutes(app)

// Must be registered after all routes
app.use(notFoundMiddleware)
app.use(errorMiddleware)

mongoose
  .connect(process.env.MONGO_URI!)
  .then(() => {
    console.log('Connected to MongoDB')
    const server = app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`))
    // Extend timeouts to cover long-running AI operations (plan gen ~5 min, code gen is async)
    server.requestTimeout = 10 * 60 * 1000  // 10 minutes
    server.headersTimeout = 10 * 60 * 1000 + 5000 // must exceed requestTimeout
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message)
    process.exit(1)
  })
