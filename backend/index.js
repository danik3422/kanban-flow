import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import http from 'node:http'
import { Server } from 'socket.io'
import jwt from 'jsonwebtoken'

import { env } from './config/env.js'
import { connectDB } from './lib/db.js'
import { apiLimiter } from './middlewares/security.middleware.js'
import Board from './models/board.model.js'
import BoardMember from './models/boardMember.model.js'
import User from './models/user.model.js'
import { setRealtimeServer } from './lib/realtime.js'
import authRoutes from './routes/auth.route.js'
import boardRoutes from './routes/board.route.js'

const app = express()
const httpServer = http.createServer(app)
const io = new Server(httpServer, {
	cors: { origin: env.corsOrigin, credentials: true },
})
setRealtimeServer(io)

io.use(async (socket, next) => {
	try {
		const cookies = Object.fromEntries((socket.handshake.headers.cookie || '').split('; ').filter(Boolean).map((item) => item.split('=')))
		const decoded = jwt.verify(cookies.jwt, env.jwtSecret)
		const user = await User.findById(decoded.userId).select('_id')
		if (!user) return next(new Error('Unauthorized'))
		socket.userId = user._id.toString()
		next()
	} catch {
		next(new Error('Unauthorized'))
	}
})

io.on('connection', (socket) => {
	socket.on('join-board', async (boardId) => {
		const board = await Board.findById(boardId).select('createdBy')
		const membership = await BoardMember.findOne({ board: boardId, user: socket.userId })
		if (board && (board.createdBy.toString() === socket.userId || membership)) socket.join(`board:${boardId}`)
	})
})

// Middleware
app.disable('x-powered-by')
app.use(helmet())
app.use(express.json({ limit: '100kb' }))
app.use(cookieParser())
app.use(
	cors({
		origin: env.corsOrigin,
		credentials: true,
	})
)
app.use('/api', apiLimiter)

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/board', boardRoutes)

// Start server and connect DB
httpServer.listen(env.port, () => {
	console.log(`Server is running on port ${env.port}`)
	connectDB()
})
