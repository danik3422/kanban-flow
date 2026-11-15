const normalizeUrl = (value) => value?.trim().replace(/\/+$/, '')

export const apiBaseUrl = normalizeUrl(import.meta.env.VITE_API_URL) || '/api'
export const socketUrl =
	normalizeUrl(import.meta.env.VITE_SOCKET_URL) || window.location.origin

// Pictures kept on the API server come as "/uploads/…". When the web app and the API
// live at different addresses (development), they are fetched from the API's.
const apiOrigin = /^https?:\/\//.test(apiBaseUrl) ? new URL(apiBaseUrl).origin : ''
// A picture as a CSS background. Card covers and attachments carry addresses other people
// chose; a quote or line break in one must not end url("...") and add CSS of its own.
export const cssUrl = (url) => `url("${String(assetUrl(url) ?? '').replace(/["\\\n\r\f]/g, (char) => encodeURIComponent(char))}")`

export const assetUrl = (url) => (apiOrigin && typeof url === 'string' && url.startsWith('/uploads/') ? `${apiOrigin}${url}` : url)
