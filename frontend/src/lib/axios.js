import axios from 'axios'
import { apiBaseUrl } from './runtimeConfig'

let sessionExpiredHandler = null
// The auth store signs out when the server says this session was ended elsewhere.
export const onSessionExpired = (handler) => {
	sessionExpiredHandler = handler
}

export const axiosInstance = axios.create({
	baseURL: apiBaseUrl,
	withCredentials: true,
	timeout: 8000,
	// The API's CSRF check accepts requests without an Origin only when they carry this.
	headers: { 'X-Requested-With': 'XMLHttpRequest' },
})

// A static host or dev server answers unknown /api paths with index.html.
// Treat that as an unavailable API instead of handing a string to the UI.
axiosInstance.interceptors.response.use((response) => {
	const contentType = String(response.headers?.['content-type'] || '')
	if (contentType.includes('text/html')) {
		const error = new Error('API returned HTML instead of JSON')
		error.response = {
			status: 503,
			data: { message: 'The server is unavailable right now. Please try again shortly.' },
		}
		return Promise.reject(error)
	}
	return response
}, (error) => {
	if (error.response?.status === 401 && error.response.data?.message === 'Unauthorized - Session expired') sessionExpiredHandler?.()
	return Promise.reject(error)
})
