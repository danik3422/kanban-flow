import { create } from 'zustand'

/**
 * Whether the app can reach the server. `offline` covers both the device having no
 * network and the API not answering; pages then show saved data, read-only.
 */
export const useConnection = create(() => ({
	deviceOnline: typeof navigator === 'undefined' ? true : navigator.onLine !== false,
	apiReachable: true,
}))

export const isOffline = () => {
	const { deviceOnline, apiReachable } = useConnection.getState()
	return !deviceOnline || !apiReachable
}

export const markApiReachable = (reachable) => {
	if (useConnection.getState().apiReachable !== reachable) useConnection.setState({ apiReachable: reachable })
}

if (typeof window !== 'undefined') {
	window.addEventListener('online', () => useConnection.setState({ deviceOnline: true }))
	window.addEventListener('offline', () => useConnection.setState({ deviceOnline: false }))
}
