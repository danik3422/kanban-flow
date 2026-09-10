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
