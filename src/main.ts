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
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`))
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message)
    process.exit(1)
  })
