import { useEffect, useRef, useState } from 'react'
import { isDevAuthBypass } from '../lib/devMode'
import { acquireSocket, isPermanentSocketFailure, releaseSocket } from '../lib/socket'

const BOARD_EVENTS = [
	'board:access-revoked',
	'board:updated',
	'activity:new',
	'task:created',
	'task:updated',
	'task:deleted',
	'column:tasks-reordered',
	'column:updated',
	'column:sort-updated',
	'column:created',
	'column:deleted',
	'columns:reordered',
]

const HEARTBEAT_MS = 20_000

// Joins the board's realtime room on the shared connection and reports its state.
// `handlers` maps board events (plus `onResync` after a reconnect) to callbacks;
// they are read through a ref so new callbacks never rejoin the room.
const useBoardRealtime = (boardId, handlers) => {
	const [status, setStatus] = useState(isDevAuthBypass ? 'connected' : 'connecting')
	const [presence, setPresence] = useState({})
	const handlersRef = useRef(handlers)

	useEffect(() => {
		handlersRef.current = handlers
	})

	useEffect(() => {
		if (!boardId || isDevAuthBypass) return undefined
		const socket = acquireSocket()
		const subscriptions = []
		let hasConnected = false
		const listen = (target, event, handler) => {
			target.on(event, handler)
			subscriptions.push(() => target.off(event, handler))
		}
		const heartbeat = () => socket.emit('presence-heartbeat')
		const handleConnect = () => {
			setStatus('connected')
			socket.emit('join-board', boardId)
			heartbeat()
			// Events sent while disconnected are lost, so resync after every reconnect.
			if (hasConnected) handlersRef.current.onResync?.()
			hasConnected = true
		}

		listen(socket, 'connect', handleConnect)
		listen(socket, 'disconnect', (reason) =>
			setStatus(isPermanentSocketFailure(socket, reason) ? 'offline' : 'reconnecting'),
		)
		listen(socket, 'connect_error', () =>
			setStatus(isPermanentSocketFailure(socket) ? 'offline' : 'reconnecting'),
		)
		listen(socket.io, 'reconnect_attempt', () => setStatus('reconnecting'))
		listen(socket.io, 'reconnect_failed', () => setStatus('offline'))
		listen(socket, 'board:presence', (entries) => {
			setPresence(Object.fromEntries(entries.map((item) => [item.userId, item.status])))
		})
		for (const event of BOARD_EVENTS) {
			listen(socket, event, (payload) => handlersRef.current[event]?.(payload))
		}

		const heartbeatTimer = window.setInterval(heartbeat, HEARTBEAT_MS)
		if (socket.connected) handleConnect()

		return () => {
			setPresence({})
			setStatus('offline')
			window.clearInterval(heartbeatTimer)
			subscriptions.forEach((unsubscribe) => unsubscribe())
			socket.emit('leave-board', boardId)
			releaseSocket()
		}
	}, [boardId])

	return { status, presence }
}

export default useBoardRealtime
