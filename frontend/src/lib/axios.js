import axios from 'axios'
import { cacheKey, readCache, writeCache } from './apiCache'
import { markApiReachable } from './connection'
import { enqueue, flushOutbox, mustQueue, pendingCount, setOutboxSender, withRealIds } from './outbox'
import { apiBaseUrl } from './runtimeConfig'

let sessionExpiredHandler = null
// The auth store signs out when the server says this session was ended elsewhere.
export const onSessionExpired = (handler) => {
	sessionExpiredHandler = handler
}

// The message every failed request shows while there is no connection (translated in i18n "server").
export const OFFLINE_MESSAGE = 'No internet connection. This will work again once you are back online.'

export const axiosInstance = axios.create({
	baseURL: apiBaseUrl,
	withCredentials: true,
	timeout: 8000,
	// The API's CSRF check accepts requests without an Origin only when they carry this.
	headers: { 'X-Requested-With': 'XMLHttpRequest' },
})

const offlineError = (cause) => {
	const error = new Error(OFFLINE_MESSAGE)
	error.isOffline = true
	error.cause = cause
	error.response = { status: 0, data: { message: OFFLINE_MESSAGE } }
	return error
}

const isGet = (config) => (config?.method || 'get').toLowerCase() === 'get'
// GET answers are saved for repeat visits and offline use; `cache: false` opts out.
const isCacheable = (config) => isGet(config) && config.cache !== false
const keyOf = (config) => cacheKey(config.url, config.params)

// What the app shows for a change it keeps for later (see lib/outbox.js).
const queuedResponse = (config) => ({ data: config.offline.response ?? {}, status: 202, statusText: 'Saved on this device', headers: {}, config, queued: true })
const keepForLater = (config) => {
	enqueue(config)
	const signal = new Error('Queued')
	signal.queuedResponse = queuedResponse(config)
	return signal
}
const deviceOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false

// Changes marked `offline` are kept on the device without a connection, or while earlier
// ones wait; the rest fail at once with a clear message instead of waiting 8 seconds.
axiosInstance.interceptors.request.use((config) => {
	if (isGet(config) || config.fromOutbox) return config
	config.url = withRealIds(config.url)
	config.data = withRealIds(config.data)
	if (config.offline && (deviceOffline() || mustQueue(config))) {
		const signal = keepForLater(config)
		if (deviceOffline()) markApiReachable(false)
		else void flushOutbox()
		return Promise.reject(signal)
	}
	if (deviceOffline()) {
		markApiReachable(false)
		return Promise.reject(offlineError())
	}
	return config
})

// A static host or dev server answers unknown /api paths with index.html.
// Treat that as an unavailable API instead of handing a string to the UI.
const isHtml = (response) => String(response.headers?.['content-type'] || '').includes('text/html')

// No answer at all (no network, server down, timed out): use what this device saved.
const fallBackToCache = (config, cause) => {
	markApiReachable(false)
	if (config && isCacheable(config)) {
		const data = readCache(keyOf(config))
		if (data !== undefined) return { data, status: 200, statusText: 'OK (saved)', headers: {}, config, fromCache: true }
	}
	return Promise.reject(offlineError(cause))
}

axiosInstance.interceptors.response.use((response) => {
	if (isHtml(response)) return fallBackToCache(response.config, new Error('API returned HTML instead of JSON'))
	markApiReachable(true)
	if (isCacheable(response.config)) writeCache(keyOf(response.config), response.data)
	// The server answers again: send what was kept while it did not.
	if (!response.config?.fromOutbox && pendingCount()) void flushOutbox()
	return response
}, (error) => {
	if (error?.queuedResponse) return error.queuedResponse
	if (axios.isCancel(error)) return Promise.reject(error)
	// No answer to a change the app can keep: save it for later instead of failing.
	if (!error.response && error.config?.offline && !error.config.fromOutbox) {
		markApiReachable(false)
		return keepForLater(error.config).queuedResponse
	}
	if (!error.response) return fallBackToCache(error.config, error)
	markApiReachable(true)
	if (error.response.status === 401 && error.response.data?.message === 'Unauthorized - Session expired') sessionExpiredHandler?.()
	return Promise.reject(error)
})

setOutboxSender((config) => axiosInstance.request(config))
