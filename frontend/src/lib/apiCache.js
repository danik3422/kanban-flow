// The last answer of every GET request, kept on this device per account.
// Pages draw from it at once (no spinner on a repeat visit) and refresh in the
// background; without a connection the app keeps working from it, read-only.
//
// Stored in IndexedDB; a copy is held in memory so a page can read it while it
// renders. Signing out (or another account signing in) wipes it.

const DB_NAME = 'kanban-cache'
const STORE = 'responses'
const OWNER_KEY = 'kanban-cache-owner'
const MAX_ENTRIES = 300
// One huge board should not push everything else out.
const MAX_ENTRY_BYTES = 3 * 1024 * 1024

const memory = new Map()
let dbPromise = null
let owner = readOwner()

function readOwner() {
	try {
		return typeof localStorage === 'undefined' ? '' : localStorage.getItem(OWNER_KEY) || ''
	} catch {
		return ''
	}
}

const writeOwner = (value) => {
	owner = value
	try {
		if (value) localStorage.setItem(OWNER_KEY, value)
		else localStorage.removeItem(OWNER_KEY)
	} catch {
		// storage blocked: the cache simply lives for this visit
	}
}

const openDb = () => {
	if (typeof indexedDB === 'undefined') return Promise.resolve(null)
	dbPromise ??= new Promise((resolve) => {
		const request = indexedDB.open(DB_NAME, 1)
		request.onupgradeneeded = () => request.result.createObjectStore(STORE)
		request.onsuccess = () => resolve(request.result)
		request.onerror = () => resolve(null)
		request.onblocked = () => resolve(null)
	})
	return dbPromise
}

const withStore = async (mode, run) => {
	const db = await openDb()
	if (!db) return undefined
	return new Promise((resolve) => {
		const transaction = db.transaction(STORE, mode)
		const result = run(transaction.objectStore(STORE))
		transaction.oncomplete = () => resolve(result?.result)
		transaction.onerror = () => resolve(undefined)
		transaction.onabort = () => resolve(undefined)
	})
}

/** "/board/calendar?from=…&scope=…": the same request always gets the same key. */
export const cacheKey = (url, params) => {
	const query = params
		? Object.entries(params)
			.filter(([, value]) => value !== undefined && value !== null && value !== '')
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(value)}`)
			.join('&')
		: ''
	return query ? `${url}?${query}` : url
}

/** Loads this account's saved answers into memory; call once before the first render. */
export const initApiCache = async () => {
	if (!owner) return
	const entries = await withStore('readonly', (store) => store.getAll())
	for (const entry of entries || []) {
		if (entry?.owner === owner) memory.set(entry.key, entry)
	}
}

/** The saved answer for a request, or undefined. */
export const peekCache = (url, params) => memory.get(cacheKey(url, params))?.data

export const writeCache = (key, data) => {
	if (!owner) return
	let size
	try {
		size = JSON.stringify(data).length
	} catch {
		return
	}
	if (size > MAX_ENTRY_BYTES) return
	const entry = { key, owner, data, savedAt: Date.now() }
	memory.delete(key)
	memory.set(key, entry)
	withStore('readwrite', (store) => store.put(entry, `${owner}|${key}`))
	if (memory.size > MAX_ENTRIES) {
		const oldest = [...memory.values()].sort((a, b) => a.savedAt - b.savedAt).slice(0, memory.size - MAX_ENTRIES)
		for (const stale of oldest) {
			memory.delete(stale.key)
			withStore('readwrite', (store) => store.delete(`${owner}|${stale.key}`))
		}
	}
}

export const readCache = (key) => memory.get(key)?.data

/** Answers belong to one account: a different one starts from an empty cache. */
export const setCacheOwner = (userId) => {
	const next = userId ? String(userId) : ''
	if (next === owner) return
	if (owner) clearApiCache()
	writeOwner(next)
}

export const clearApiCache = () => {
	memory.clear()
	writeOwner('')
	withStore('readwrite', (store) => store.clear())
}
