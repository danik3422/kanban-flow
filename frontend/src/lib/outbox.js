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
// A change the server keeps failing on waits longer each time: 15s, 30s, 1m, 2m, 4m.
const MAX_RETRY_MS = 5 * 60 * 1000

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

/**
 * `items`: the queued requests on this device, each tied to the account that made it;
 * `owner`: the signed-in account (see syncOutboxOwner); `syncing` while they are sent.
 */
export const useOutbox = create(() => ({ items: readItems(), owner: readOwner(), syncing: false }))

/** How many changes of the signed-in account wait to be sent; a selector for useOutbox. */
export const selectPending = (state) => (state.owner ? state.items.filter((item) => item.owner === state.owner).length : 0)

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
let sessionCheck = null
let retryTimer = null
let retryAt = 0
// One timer for the whole queue, at the earliest moment something can be tried again.
const scheduleRetry = (delay = RETRY_MS) => {
	if (typeof window === 'undefined') return
	const at = Date.now() + delay
	if (retryTimer && retryAt <= at) return
	window.clearTimeout(retryTimer)
	retryAt = at
	retryTimer = window.setTimeout(() => {
		retryTimer = null
		void flushOutbox()
	}, delay)
}

/** The axios instance that actually sends; set once by lib/axios.js. */
export const setOutboxSender = (send) => {
	sender = send
}

/** Asks whether the session still holds (after a 401); set once by the auth store. */
export const setOutboxSessionCheck = (check) => {
	sessionCheck = check
}

/**
 * Follows the signed-in account (call it whenever it changes). When another account
 * signs in on this device, what an earlier one left unsent is dropped: it would never be
 * sent from here and should not stay on a shared device.
 */
export const syncOutboxOwner = () => {
	const owner = readOwner()
	const { items } = useOutbox.getState()
	const kept = owner ? items.filter((item) => !item.owner || item.owner === owner) : items
	if (kept.length !== items.length) setItems(kept)
	useOutbox.setState({ owner })
}

// What to do with a change the server did not take:
// - 'wait': it could not be reached, or asked to slow down; try again later, as it was.
// - 'retry': a server error; try again later, counting the try.
// - 'session': a 401; the session may have ended. The auth store checks it: if it did,
//   the change waits for the account to sign in again; if not, it counts as a try.
// - 'drop': refused (another 4xx: gone, forbidden, invalid), or failed too many times,
//   so one broken change cannot hold up the queue for good.
const MAX_TRIES = 5
const WAIT_STATUSES = new Set([408, 425, 429])
export const outboxVerdict = (error, tries = 0) => {
	if (error?.isOffline) return 'wait'
	const status = error?.response?.status
	if (!status || WAIT_STATUSES.has(status)) return 'wait'
	if (status === 401 || status >= 500) {
		if (tries + 1 >= MAX_TRIES) return 'drop'
		return status === 401 ? 'session' : 'retry'
	}
	return 'drop'
}

const retryDelay = (tries) => Math.min(RETRY_MS * 2 ** (tries - 1), MAX_RETRY_MS)

/**
 * Sends the queue in order. A change the server can't take now stops the run (it is
 * tried again later, see `outboxVerdict`); one the server refuses is dropped and counted.
 * When the queue is empty, `kh:outbox-synced` tells the pages to reload what they show.
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
			// A change that failed waits out its pause, whatever else sets off a send.
			if (item.nextTryAt > Date.now()) {
				scheduleRetry(item.nextTryAt - Date.now())
				break
			}
			const url = withRealIds(item.url)
			const data = withRealIds(item.data)
			try {
				const response = await sender({ method: item.method, url, data, fromOutbox: true })
				if (item.tempId && response?.data?._id) realIds.set(item.tempId, String(response.data._id))
				sent++
			} catch (error) {
				const verdict = outboxVerdict(error, item.tries)
				if (verdict === 'wait') {
					scheduleRetry()
					break
				}
				if (verdict !== 'drop') {
					const tries = (item.tries || 0) + 1
					const delay = retryDelay(tries)
					setItems(useOutbox.getState().items.map((queued) => (queued.id === item.id ? { ...queued, tries, nextTryAt: Date.now() + delay } : queued)))
					if (verdict === 'session') sessionCheck?.()
					scheduleRetry(delay)
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

/** Signing out on purpose drops what the account had not sent yet. */
export const clearOutbox = () => {
	realIds.clear()
	setItems([])
}

if (typeof window !== 'undefined') {
	window.addEventListener('online', () => window.setTimeout(() => void flushOutbox(), 800))
}
