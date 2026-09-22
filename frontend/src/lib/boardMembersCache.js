import { axiosInstance } from './axios'

const CACHE_KEY = 'kanban-board-members-cache'
const CACHE_TTL = 5 * 60 * 1000

const getCacheKey = (userId) => `${CACHE_KEY}:${userId || 'anonymous'}`

const readSessionCache = (userId) => {
	if (typeof window === 'undefined') return {}
	try {
		const saved = window.sessionStorage.getItem(getCacheKey(userId))
		if (!saved) return {}
		const parsed = JSON.parse(saved)
		if (!parsed || typeof parsed !== 'object') return {}
		return parsed
	} catch {
		return {}
	}
}

const writeSessionCache = (userId, payload) => {
	if (typeof window === 'undefined') return
	try {
		window.sessionStorage.setItem(getCacheKey(userId), JSON.stringify(payload))
	} catch {
		// ignore storage issues
	}
}

const isFresh = (timestamp) => Date.now() - timestamp <= CACHE_TTL

const getBoardMembersCache = (userId) => {
	const snapshot = readSessionCache(userId)
	if (!snapshot || !snapshot.data || typeof snapshot.data !== 'object') {
		return {}
	}
	const entries = Object.fromEntries(
		Object.entries(snapshot.data).filter(([, value]) => value && typeof value === 'object' && typeof value.cachedAt === 'number' && isFresh(value.cachedAt)),
	)
	if (Object.keys(entries).length !== Object.keys(snapshot.data || {}).length) {
		writeSessionCache(userId, { ...snapshot, data: entries })
	}
	return entries
}

export const getCachedBoardMembers = (userId, boardId) => {
	if (!boardId) return null
	const cache = getBoardMembersCache(userId)
	const item = cache[String(boardId)]
	if (!item || !Array.isArray(item.members)) return null
	return item.members
}

export const setCachedBoardMembers = (userId, boardId, members) => {
	if (!boardId) return null
	const cache = getBoardMembersCache(userId)
	const next = {
		...cache,
		[String(boardId)]: {
			cachedAt: Date.now(),
			members: Array.isArray(members) ? members : [],
		},
	}
	writeSessionCache(userId, { data: next })
	return next[String(boardId)]?.members || []
}

export const fetchBoardMembersWithCache = async (userId, boardId) => {
	if (!boardId) return []
	const cached = getCachedBoardMembers(userId, boardId)
	if (cached) return cached

	const { data } = await axiosInstance.get(`/board/boards/${boardId}/members`)
	return setCachedBoardMembers(userId, boardId, data)
}
