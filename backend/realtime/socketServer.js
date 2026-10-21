import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import { Server } from 'socket.io'

import { env } from '../config/env.js'
import { setRealtimeServer } from '../lib/realtime.js'
import Board from '../models/board.model.js'
import BoardMember from '../models/boardMember.model.js'
import Session from '../models/session.model.js'
import User from '../models/user.model.js'
import { isAllowedOrigin } from '../middlewares/csrf.middleware.js'

// Live updates over Socket.IO: who may connect, the rooms each socket joins
// (user, session and the open board), and who is looking at which board.

// Split each cookie pair at its first "=" only: values may contain more of them.
const readCookies = (header = '') =>
	Object.fromEntries(header.split(/;\s*/).filter(Boolean).map((item) => {
		const at = item.indexOf('=')
		return at < 0 ? [item, ''] : [item.slice(0, at), decodeURIComponent(item.slice(at + 1))]
	}))

export const createSocketServer = (httpServer) => {
	const io = new Server(httpServer, {
		cors: { origin: env.corsOrigin, credentials: true },
		// CORS does not cover WebSocket upgrades: refuse pages from other sites outright.
		allowRequest: (req, callback) => {
			const origin = req.headers.origin
			callback(null, !origin || isAllowedOrigin(origin, req.headers.host))
		},
	})

	// boardId -> Map(userId -> { connections, lastSeenAt })
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

	// Same checks as the HTTP auth middleware: a valid cookie, a verified email,
	// the current session version and a session that has not been signed out.
	io.use(async (socket, next) => {
		try {
			const cookies = readCookies(socket.handshake.headers.cookie || '')
			const decoded = jwt.verify(cookies.jwt, env.jwtSecret, { algorithms: ['HS256'] })
			const user = await User.findById(decoded.userId).select('_id sessionVersion emailVerified')
			if (!user) return next(new Error('Unauthorized'))
			if (!user.emailVerified) return next(new Error('Email verification required'))
			if (Number(decoded.sessionVersion || 0) !== Number(user.sessionVersion || 0)) {
				return next(new Error('Session expired'))
			}
			if (!decoded.sid || !(await Session.exists({ sid: decoded.sid, user: user._id }))) {
				return next(new Error('Session expired'))
			}
			socket.userId = user._id.toString()
			socket.sessionVersion = Number(user.sessionVersion || 0)
			socket.sid = decoded.sid
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

	return io
}
