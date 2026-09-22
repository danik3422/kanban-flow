import { axiosInstance } from './axios'

const BOARDS_CACHE_KEY = 'kanban-boards-cache'
const BOARDS_CACHE_TTL = 5 * 60 * 1000
let inMemoryBoards = null
let inMemoryCachedAt = 0
let inMemoryUserId = null

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
	const cached = readSessionCache(userId)
	if (cached) {
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
	return inMemoryBoards
}

export const clearBoardsCache = () => {
	inMemoryBoards = null
	inMemoryCachedAt = 0
	inMemoryUserId = null
	if (typeof window !== 'undefined') {
		Object.keys(window.sessionStorage).filter((key) => key.startsWith(`${BOARDS_CACHE_KEY}:`)).forEach((key) => window.sessionStorage.removeItem(key))
	}
}

export const fetchBoardsWithCache = async (userId) => {
	const cached = getCachedBoards(userId)
	if (cached) return cached

	const { data } = await axiosInstance.get('/board/boards')
	return setCachedBoards(userId, data)
}
