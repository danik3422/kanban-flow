import { axiosInstance } from './axios'

const CACHE_KEY = 'kanban-board-members-cache'
const CACHE_TTL = 5 * 60 * 1000

const readSessionCache = () => {
	if (typeof window === 'undefined') return {}
	try {
		const saved = window.sessionStorage.getItem(CACHE_KEY)
		if (!saved) return {}
		const parsed = JSON.parse(saved)
		if (!parsed || typeof parsed !== 'object') return {}
		return parsed
	} catch {
		return {}
	}
}

const writeSessionCache = (payload) => {
	if (typeof window === 'undefined') return
	try {
		window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(payload))
	} catch {
		// ignore storage issues
	}
}

const isFresh = (timestamp) => Date.now() - timestamp <= CACHE_TTL

const getBoardMembersCache = () => {
	const snapshot = readSessionCache()
	if (!snapshot || !snapshot.data || typeof snapshot.data !== 'object') {
		return {}
	}
	const entries = Object.fromEntries(
		Object.entries(snapshot.data).filter(([, value]) => value && typeof value === 'object' && typeof value.cachedAt === 'number' && isFresh(value.cachedAt)),
	)
	if (Object.keys(entries).length !== Object.keys(snapshot.data || {}).length) {
		writeSessionCache({ ...snapshot, data: entries })
	}
	return entries
}

export const getCachedBoardMembers = (boardId) => {
	if (!boardId) return null
	const cache = getBoardMembersCache()
	const item = cache[String(boardId)]
	if (!item || !Array.isArray(item.members)) return null
	return item.members
}

export const setCachedBoardMembers = (boardId, members) => {
	if (!boardId) return null
	const cache = getBoardMembersCache()
	const next = {
		...cache,
		[String(boardId)]: {
			cachedAt: Date.now(),
			members: Array.isArray(members) ? members : [],
		},
	}
	writeSessionCache({ data: next })
	return next[String(boardId)]?.members || []
}

export const fetchBoardMembersWithCache = async (boardId) => {
	if (!boardId) return []
	const cached = getCachedBoardMembers(boardId)
	if (cached) return cached

	const { data } = await axiosInstance.get(`/board/boards/${boardId}/members`)
	return setCachedBoardMembers(boardId, data)
}
