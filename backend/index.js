import cookieParser from 'cookie-parser'
import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'

import { connectDB } from './lib/db.js'
import authRoutes from './routes/auth.route.js'
import boardRoutes from './routes/board.route.js'

dotenv.config()

const PORT = process.env.PORT || 5001
const app = express()

// Middleware
app.use(express.json())
app.use(cookieParser())
app.use(
	cors({
		origin: 'http://localhost:5173',
		credentials: true,
	})
)

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/board', boardRoutes)

// Start server and connect DB
app.listen(PORT, () => {
	console.log(`Server is running on port ${PORT}`)
	connectDB()
})
