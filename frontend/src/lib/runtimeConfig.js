const normalizeUrl = (value) => value?.trim().replace(/\/+$/, '')

export const apiBaseUrl = normalizeUrl(import.meta.env.VITE_API_URL) || '/api'
export const socketUrl =
	normalizeUrl(import.meta.env.VITE_SOCKET_URL) || window.location.origin
