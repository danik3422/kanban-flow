let io = null

export const setRealtimeServer = (server) => {
	io = server
}

export const emitBoardEvent = (boardId, event, payload) => {
	if (io) io.to(`board:${boardId}`).emit(event, payload)
}

export const emitUserEvent = (userId, event, payload) => {
	if (io) io.to(`user:${userId}`).emit(event, payload)
}

export const revokeUserBoardAccess = (userId, boardId, payload = {}) => {
	if (!io) return
	const userRoom = `user:${userId}`
	const boardRoom = `board:${boardId}`
	io.in(userRoom).socketsLeave(boardRoom)
	io.to(userRoom).emit('board:access-revoked', {
		boardId: boardId.toString(),
		...payload,
	})
}

// A device that was signed out drops its live connection; the others just re-check.
export const disconnectSession = (sid) => {
	if (!io || !sid) return
	const room = `session:${sid}`
	io.to(room).emit('session:changed', {})
	// Give the event a moment to arrive, so the device re-checks and shows it was signed out.
	setTimeout(() => io?.in(room).disconnectSockets(true), 2000).unref?.()
}
