import { peekCache } from './apiCache'
import { axiosInstance } from './axios'

const BOARDS_CACHE_KEY = 'kanban-boards-cache'
const BOARDS_CACHE_TTL = 5 * 60 * 1000
let inMemoryBoards = null
let inMemoryCachedAt = 0
let inMemoryUserId = null
// The sidebar listens, so every page shows the same boards from its first frame.
const listeners = new Set()
const notify = () => listeners.forEach((listener) => listener())
export const subscribeBoards = (listener) => {
	listeners.add(listener)
	return () => listeners.delete(listener)
}

const getCacheKey = (userId) => `${BOARDS_CACHE_KEY}:${userId || 'anonymous'}`

const readSessionCache = (userId) => {
	if (typeof window === 'undefined') return null
	try {
		const saved = window.sessionStorage.getItem(getCacheKey(userId))
		if (!saved) return null
		const parsed = JSON.parse(saved)
		if (!parsed || !Array.isArray(parsed.data)) return null
		if (Date.now() - parsed.cachedAt > BOARDS_CACHE_TTL) {
			window.sessionStorage.removeItem(getCacheKey(userId))
			return null
		}
		return parsed.data
	} catch {
		return null
	}
}

const writeSessionCache = (userId, boards) => {
	if (typeof window === 'undefined') return
	try {
		window.sessionStorage.setItem(
			getCacheKey(userId),
			JSON.stringify({
				cachedAt: Date.now(),
				data: boards,
			}),
		)
	} catch {
		// ignore storage issues
	}
}

export const getCachedBoards = (userId) => {
	if (inMemoryUserId === userId && inMemoryBoards && Date.now() - inMemoryCachedAt <= BOARDS_CACHE_TTL) {
		return inMemoryBoards
	}
	// Older than this visit: the copy saved on the device; callers refresh it once.
	const cached = readSessionCache(userId) || (userId ? peekCache('/board/boards') : null)
	if (Array.isArray(cached)) {
		inMemoryBoards = cached
		inMemoryCachedAt = Date.now()
		inMemoryUserId = userId
		return cached
	}
	inMemoryBoards = null
	inMemoryCachedAt = 0
	inMemoryUserId = null
	return null
}

export const setCachedBoards = (userId, boards) => {
	inMemoryBoards = Array.isArray(boards) ? boards : []
	inMemoryCachedAt = Date.now()
	inMemoryUserId = userId
	writeSessionCache(userId, inMemoryBoards)
	notify()
	return inMemoryBoards
}

export const clearBoardsCache = () => {
	inMemoryBoards = null
	inMemoryCachedAt = 0
	inMemoryUserId = null
	notify()
	if (typeof window === 'undefined') return
	try {
		Object.keys(window.sessionStorage)
			.filter((key) => key.startsWith(`${BOARDS_CACHE_KEY}:`))
			.forEach((key) => window.sessionStorage.removeItem(key))
	} catch {
		// ignore storage issues
	}
}

export const fetchBoardsWithCache = async (userId, { fresh = false } = {}) => {
	const cached = fresh ? null : getCachedBoards(userId)
	if (cached) return cached

	const { data } = await axiosInstance.get('/board/boards')
	return setCachedBoards(userId, data)
}
