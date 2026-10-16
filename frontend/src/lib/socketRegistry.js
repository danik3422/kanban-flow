// Connection state without the socket.io client itself, so code that only needs
// to drop the connection (sign-out) does not pull socket.io into the main bundle.
export const registry = {
	socket: null,
	holders: 0,
	releaseTimer: null,
}

// The connection is authenticated with the cookie of whoever opened it; drop it the
// moment that session ends so the next account never inherits it.
export const resetSocket = () => {
	window.clearTimeout(registry.releaseTimer)
	registry.socket?.disconnect()
	registry.socket = null
	registry.holders = 0
}
