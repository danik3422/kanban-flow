const normalizeUrl = (value) => value?.trim().replace(/\/+$/, '')

export const apiBaseUrl = normalizeUrl(import.meta.env.VITE_API_URL) || '/api'
export const socketUrl =
	normalizeUrl(import.meta.env.VITE_SOCKET_URL) || window.location.origin

// Pictures kept on the API server come as "/uploads/…". When the web app and the API
// live at different addresses (development), they are fetched from the API's.
const apiOrigin = /^https?:\/\//.test(apiBaseUrl) ? new URL(apiBaseUrl).origin : ''
export const assetUrl = (url) => (apiOrigin && typeof url === 'string' && url.startsWith('/uploads/') ? `${apiOrigin}${url}` : url)
