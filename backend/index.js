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
import notificationRoutes from './routes/notification.route.js'

const app = express()
const httpServer = http.createServer(app)
const io = new Server(httpServer, {
	cors: { origin: env.corsOrigin, credentials: true },
})
const boardPresence = new Map()

const getPresenceSnapshot = (users) =>
	Array.from(users, ([userId, presence]) => ({
		userId,
		status: Date.now() - presence.lastSeenAt > 45_000 ? 'away' : 'online',
	}))

const broadcastBoardPresence = (boardId) => {
	const users = boardPresence.get(boardId)
	if (users) {
		io.to(`board:${boardId}`).emit('board:presence', getPresenceSnapshot(users))
	}
}

const presenceInterval = setInterval(() => {
	for (const boardId of boardPresence.keys()) broadcastBoardPresence(boardId)
}, 15_000)
presenceInterval.unref?.()

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
	socket.join(`user:${socket.userId}`)
	socket.on('join-board', async (boardId) => {
		if (socket.boardId === boardId) return
		if (socket.boardId) {
			const previousUsers = boardPresence.get(socket.boardId)
			if (previousUsers) {
				const count = previousUsers.get(socket.userId) || 0
				if (count <= 1) previousUsers.delete(socket.userId)
				else previousUsers.set(socket.userId, count - 1)
				broadcastBoardPresence(socket.boardId)
			}
			socket.leave(`board:${socket.boardId}`)
			socket.boardId = null
		}
		const board = await Board.findById(boardId).select('createdBy')
		const membership = await BoardMember.findOne({ board: boardId, user: socket.userId })
		if (board && (board.createdBy.toString() === socket.userId || membership)) {
			socket.join(`board:${boardId}`)
			socket.boardId = boardId
			const users = boardPresence.get(boardId) || new Map()
			const presence = users.get(socket.userId) || {
				connections: 0,
				lastSeenAt: Date.now(),
			}
			presence.connections += 1
			presence.lastSeenAt = Date.now()
			users.set(socket.userId, presence)
			boardPresence.set(boardId, users)
			broadcastBoardPresence(boardId)
		}
	})
	socket.on('presence-heartbeat', () => {
		if (!socket.boardId) return
		const users = boardPresence.get(socket.boardId)
		const presence = users?.get(socket.userId)
		if (!presence) return
		presence.lastSeenAt = Date.now()
		broadcastBoardPresence(socket.boardId)
	})
	socket.on('disconnect', () => {
		if (!socket.boardId) return
		const users = boardPresence.get(socket.boardId)
		if (!users) return
		const presence = users.get(socket.userId)
		if (!presence || presence.connections <= 1) users.delete(socket.userId)
		else presence.connections -= 1
		broadcastBoardPresence(socket.boardId)
		if (users.size === 0) boardPresence.delete(socket.boardId)
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
app.use('/api/notifications', notificationRoutes)

// Connect the database before accepting requests so auth never runs against an
// unready MongoDB connection.
export const startServer = async () => {
	await connectDB()
	httpServer.listen(env.port, () => {
		console.log(`Server is running on port ${env.port}`)
	})
}

export { app, httpServer, io }

if (process.env.NODE_ENV !== 'test') {
	startServer().catch((error) => {
		console.error('Server startup failed:', error)
		process.exitCode = 1
	})
}
