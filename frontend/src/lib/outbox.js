import { create } from 'zustand'

// Changes made without a connection: kept on this device, in order, and sent to the
// server as soon as it can be reached again. The app shows them at once (each request
// says what to show with `offline.response`), so working offline feels normal.
//
// Cards created offline get a temporary id ("local-…"). When the server answers the
// creation, later changes in the queue that mention that id are rewritten to the real one.

const STORAGE_KEY = 'kh:outbox'
const OWNER_KEY = 'kanban-cache-owner' // the signed-in account, shared with apiCache
const RETRY_MS = 15000

const readOwner = () => {
	try {
		return localStorage.getItem(OWNER_KEY) || ''
	} catch {
		return ''
	}
}

const readItems = () => {
	try {
		const items = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
		return Array.isArray(items) ? items : []
	} catch {
		return []
	}
}

const persist = (items) => {
	try {
		if (items.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
		else localStorage.removeItem(STORAGE_KEY)
	} catch {
		// Storage blocked: the queue still works for this visit.
	}
}

/** `items`: the queued requests of the signed-in account; `syncing` while they are sent. */
export const useOutbox = create(() => ({ items: readItems(), syncing: false }))

const setItems = (items) => {
	persist(items)
	useOutbox.setState({ items })
}

const mine = () => useOutbox.getState().items.filter((item) => item.owner === readOwner())

// Temporary ids of cards created offline, and the real ids the server gave them.
const realIds = new Map()

export const makeTempId = () => `local-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`
export const isTempId = (id) => typeof id === 'string' && id.startsWith('local-')
export const pendingCount = () => mine().length

/** A url or body with every known temporary id replaced by the real one. */
export const withRealIds = (value) => {
	if (!realIds.size || value === undefined || value === null) return value
	let text = typeof value === 'string' ? value : JSON.stringify(value)
	for (const [temp, real] of realIds) text = text.split(temp).join(real)
	return typeof value === 'string' ? text : JSON.parse(text)
}

/** True when a change has to wait behind earlier ones, or names a card the server has not seen yet. */
export const mustQueue = (config) => mine().length > 0 || /local-/.test(withRealIds(config.url) || '') || /"local-/.test(JSON.stringify(withRealIds(config.data) ?? ''))

/** Keeps a request for later. `offline.tempId` is the id the app gave a card it created. */
export const enqueue = (config) => {
	const body = typeof config.data === 'string' ? JSON.parse(config.data || 'null') : config.data
	const item = {
		id: makeTempId(),
		owner: readOwner(),
		method: (config.method || 'post').toLowerCase(),
		url: config.url,
		data: body ?? null,
		tempId: config.offline?.tempId || null,
		at: Date.now(),
	}
	setItems([...useOutbox.getState().items, item])
	scheduleRetry()
	return item
}

let sender = null
let retryTimer = null
const scheduleRetry = () => {
	if (retryTimer || typeof window === 'undefined') return
	retryTimer = window.setTimeout(() => {
		retryTimer = null
		void flushOutbox()
	}, RETRY_MS)
}

/** The axios instance that actually sends; set once by lib/axios.js. */
export const setOutboxSender = (send) => {
	sender = send
}

/**
 * Sends the queue in order. A request the network can't carry stops the run (it is
 * tried again later); one the server refuses is dropped and counted. When the queue is
 * empty, `kh:outbox-synced` tells the pages to reload what they show.
 */
export const flushOutbox = async () => {
	if (!sender || useOutbox.getState().syncing || !mine().length) return
	useOutbox.setState({ syncing: true })
	let sent = 0
	let failed = 0
	try {
		for (;;) {
			const item = mine()[0]
			if (!item) break
			const url = withRealIds(item.url)
			const data = withRealIds(item.data)
			try {
				const response = await sender({ method: item.method, url, data, fromOutbox: true })
				if (item.tempId && response?.data?._id) realIds.set(item.tempId, String(response.data._id))
				sent++
			} catch (error) {
				if (error?.isOffline) {
					scheduleRetry()
					break
				}
				failed++
			}
			setItems(useOutbox.getState().items.filter((queued) => queued.id !== item.id))
		}
	} finally {
		useOutbox.setState({ syncing: false })
	}
	if ((sent || failed) && !mine().length && typeof window !== 'undefined') {
		window.dispatchEvent(new CustomEvent('kh:outbox-synced', { detail: { sent, failed, realIds: Object.fromEntries(realIds) } }))
	}
}

/** Signing out drops what the account had not sent yet. */
export const clearOutbox = () => {
	realIds.clear()
	setItems([])
}

if (typeof window !== 'undefined') {
	window.addEventListener('online', () => window.setTimeout(() => void flushOutbox(), 800))
}
