import { axiosInstance } from './axios'

const BOARDS_CACHE_KEY = 'kanban-boards-cache'
const BOARDS_CACHE_TTL = 5 * 60 * 1000
let inMemoryBoards = null
let inMemoryCachedAt = 0

const readSessionCache = () => {
	if (typeof window === 'undefined') return null
	try {
		const saved = window.sessionStorage.getItem(BOARDS_CACHE_KEY)
		if (!saved) return null
		const parsed = JSON.parse(saved)
		if (!parsed || !Array.isArray(parsed.data)) return null
		if (Date.now() - parsed.cachedAt > BOARDS_CACHE_TTL) {
			window.sessionStorage.removeItem(BOARDS_CACHE_KEY)
			return null
		}
		return parsed.data
	} catch {
		return null
	}
}

const writeSessionCache = (boards) => {
	if (typeof window === 'undefined') return
	try {
		window.sessionStorage.setItem(
			BOARDS_CACHE_KEY,
			JSON.stringify({
				cachedAt: Date.now(),
				data: boards,
			}),
		)
	} catch {
		// ignore storage issues
	}
}

export const getCachedBoards = () => {
	if (inMemoryBoards && Date.now() - inMemoryCachedAt <= BOARDS_CACHE_TTL) {
		return inMemoryBoards
	}
	const cached = readSessionCache()
	if (cached) {
		inMemoryBoards = cached
		inMemoryCachedAt = Date.now()
		return cached
	}
	inMemoryBoards = null
	inMemoryCachedAt = 0
	return null
}

export const setCachedBoards = (boards) => {
	inMemoryBoards = Array.isArray(boards) ? boards : []
	inMemoryCachedAt = Date.now()
	writeSessionCache(inMemoryBoards)
	return inMemoryBoards
}

export const clearBoardsCache = () => {
	inMemoryBoards = null
	inMemoryCachedAt = 0
	if (typeof window !== 'undefined') {
		window.sessionStorage.removeItem(BOARDS_CACHE_KEY)
	}
}

export const fetchBoardsWithCache = async () => {
	const cached = getCachedBoards()
	if (cached) return cached

	const { data } = await axiosInstance.get('/board/boards')
	return setCachedBoards(data)
}
