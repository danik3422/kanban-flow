import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import http from 'node:http'
import { Server } from 'socket.io'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'

import { env } from './config/env.js'
import { connectDB } from './lib/db.js'
import { apiLimiter } from './middlewares/security.middleware.js'
import { csrfProtection } from './middlewares/csrf.middleware.js'
import Board from './models/board.model.js'
import BoardMember from './models/boardMember.model.js'
import User from './models/user.model.js'
import Session from './models/session.model.js'
import { runDueReminders, runEmailDigests, startEmailJobs } from './lib/emailJobs.js'
import { PREVIEW_NAMES, renderPreview } from './lib/emails/preview.js'
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
		const decoded = jwt.verify(cookies.jwt, env.jwtSecret, { algorithms: ['HS256'] })
		const user = await User.findById(decoded.userId).select('_id sessionVersion emailVerified')
		if (!user) return next(new Error('Unauthorized'))
		if (!user.emailVerified) return next(new Error('Email verification required'))
		if (Number(decoded.sessionVersion || 0) !== Number(user.sessionVersion || 0)) {
			return next(new Error('Session expired'))
		}
		if (decoded.sid && !(await Session.exists({ sid: decoded.sid, user: user._id }))) {
			return next(new Error('Session expired'))
		}
		socket.userId = user._id.toString()
		socket.sessionVersion = Number(user.sessionVersion || 0)
		socket.sid = decoded.sid || null
		next()
	} catch {
		next(new Error('Unauthorized'))
	}
})

io.on('connection', (socket) => {
	const leaveBoard = () => {
		if (!socket.boardId) return
		const previousBoardId = socket.boardId
		const previousUsers = boardPresence.get(previousBoardId)
		if (previousUsers) {
			const presence = previousUsers.get(socket.userId)
			if (presence && presence.connections > 1) presence.connections -= 1
			else previousUsers.delete(socket.userId)
			broadcastBoardPresence(previousBoardId)
			if (previousUsers.size === 0) boardPresence.delete(previousBoardId)
		}
		socket.leave(`board:${previousBoardId}`)
		socket.boardId = null
	}

	socket.join(`user:${socket.userId}`)
	if (socket.sid) socket.join(`session:${socket.sid}`)
	socket.on('join-board', async (boardId) => {
		try {
			if (!mongoose.Types.ObjectId.isValid(boardId)) return
			const currentUser = await User.findById(socket.userId).select('_id sessionVersion')
			if (!currentUser || Number(currentUser.sessionVersion || 0) !== socket.sessionVersion) {
				leaveBoard()
				socket.disconnect(true)
				return
			}
			if (socket.boardId === boardId) return
			leaveBoard()
			const board = await Board.findById(boardId).select('createdBy')
			const membership = await BoardMember.findOne({ board: boardId, user: socket.userId })
			if (board && (board.createdBy.toString() === socket.userId || membership)) {
				socket.join(`board:${boardId}`)
				socket.boardId = boardId
				const users = boardPresence.get(boardId) || new Map()
				const presence = users.get(socket.userId) || { connections: 0, lastSeenAt: Date.now() }
				presence.connections += 1
				presence.lastSeenAt = Date.now()
				users.set(socket.userId, presence)
				boardPresence.set(boardId, users)
				broadcastBoardPresence(boardId)
			}
		} catch (error) {
			console.warn('Socket board join failed:', error.message)
		}
	})
	socket.on('presence-heartbeat', async () => {
		if (!socket.boardId) return
		const currentUser = await User.findById(socket.userId).select('_id sessionVersion').catch(() => null)
		if (!currentUser || Number(currentUser.sessionVersion || 0) !== socket.sessionVersion) {
			leaveBoard()
			socket.disconnect(true)
			return
		}
		const users = boardPresence.get(socket.boardId)
		const presence = users?.get(socket.userId)
		if (!presence) return
		presence.lastSeenAt = Date.now()
		broadcastBoardPresence(socket.boardId)
	})
	// The connection is shared across pages, so leaving a board must not require a disconnect.
	socket.on('leave-board', (boardId) => {
		if (socket.boardId && socket.boardId === boardId) leaveBoard()
	})
	socket.on('disconnect', () => {
		leaveBoard()
	})
})

// Middleware
app.disable('x-powered-by')
// Render and similar hosts terminate TLS at a proxy; without this every client
// shares the proxy IP and rate limits become global.
app.set('trust proxy', env.trustProxy)
app.use(helmet())
// Avatar payloads are compressed client-side, but base64 adds overhead.
// Card images are the one upload large enough to need more room.
const jsonBody = express.json({ limit: '200kb' })
const imageBody = express.json({ limit: '8mb' })
app.use((req, res, next) => (req.path.endsWith('/attachments/image') ? imageBody : jsonBody)(req, res, next))
app.use(cookieParser())
app.use(
	cors({
		origin: env.corsOrigin,
		credentials: true,
	})
)

app.get('/health', (_req, res) => {
	res.status(200).json({ status: 'ok' })
})
app.use('/api', csrfProtection)
app.use('/api', apiLimiter)

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/board', boardRoutes)
app.use('/api/notifications', notificationRoutes)

// Development helpers: look at every email, and run the email jobs without waiting.
if (!env.isProduction) {
	app.get('/api/dev/emails', (req, res) => {
		res.type('html').send(`<!doctype html><meta charset="utf-8"><title>Emails</title><body style="font-family:system-ui;padding:24px"><h1>Emails</h1>${['en', 'uk', 'ru'].map((lang) => `<h2>${lang}</h2><ul>${PREVIEW_NAMES.map((name) => `<li><a href="/api/dev/emails/${name}?lang=${lang}">${name}</a></li>`).join('')}</ul>`).join('')}</body>`)
	})
	app.get('/api/dev/emails/:name', (req, res) => {
		const email = renderPreview(req.params.name, ['en', 'uk', 'ru'].includes(req.query.lang) ? req.query.lang : 'en')
		if (!email) return res.status(404).send('Unknown email')
		return req.query.format === 'text' ? res.type('text').send(`${email.subject}\n\n${email.text}`) : res.type('html').send(email.html)
	})
	app.post('/api/dev/run-email-jobs', async (req, res) => {
		const reminded = await runDueReminders()
		const digests = await runEmailDigests({ force: true })
		res.json({ reminded, digests })
	})
}

// Connect the database before accepting requests so auth never runs against an
// unready MongoDB connection.
export const startServer = async () => {
	await connectDB()
	// People who had email turned off keep it off under the new frequency setting.
	await User.updateMany({ emailNotifications: false, emailFrequency: { $exists: false } }, { $set: { emailFrequency: 'never' } })
	startEmailJobs()
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
