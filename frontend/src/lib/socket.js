import { io } from 'socket.io-client'
import { registry } from './socketRegistry'
import { socketUrl } from './runtimeConfig'

// One connection per tab, shared by the board and the notification bell.
export const acquireSocket = () => {
	window.clearTimeout(registry.releaseTimer)
	if (!registry.socket) {
		registry.socket = io(socketUrl, {
			withCredentials: true,
			reconnection: true,
			reconnectionAttempts: Infinity,
			reconnectionDelay: 500,
			reconnectionDelayMax: 5000,
			timeout: 8000,
		})
	}
	registry.holders += 1
	return registry.socket
}

export const releaseSocket = () => {
	registry.holders = Math.max(0, registry.holders - 1)
	if (registry.holders > 0) return
	// Page changes unmount and remount holders; keep the connection across that gap.
	window.clearTimeout(registry.releaseTimer)
	registry.releaseTimer = window.setTimeout(() => {
		if (registry.holders > 0 || !registry.socket) return
		registry.socket.disconnect()
		registry.socket = null
	}, 3000)
}

// The server refused the session or dropped it on purpose; socket.io will not retry.
export const isPermanentSocketFailure = (activeSocket, reason) =>
	reason === 'io server disconnect' || !activeSocket.active
