let io = null

export const setRealtimeServer = (server) => {
	io = server
}

export const emitBoardEvent = (boardId, event, payload) => {
	if (io) io.to(`board:${boardId}`).emit(event, payload)
}
