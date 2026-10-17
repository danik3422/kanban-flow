import { create } from 'zustand'

// Starred and recently opened boards, kept per account in this browser.
const MAX_RECENT = 10
const keys = (userId) => ({ starred: `kh:starred:${userId}`, recent: `kh:recent:${userId}` })

const read = (key, fallback) => {
	try {
		const value = JSON.parse(localStorage.getItem(key))
		return Array.isArray(value) ? value : fallback
	} catch {
		return fallback
	}
}

const write = (key, value) => {
	try {
		localStorage.setItem(key, JSON.stringify(value))
	} catch {
		// Still works for this visit when storage is unavailable.
	}
}

export const useBoardPrefs = create((set, get) => ({
	userId: null,
	starred: [],
	recent: [],

	load: (userId) => {
		if (!userId || get().userId === userId) return
		const { starred, recent } = keys(userId)
		set({ userId, starred: read(starred, []), recent: read(recent, []) })
	},

	toggleStar: (boardId) => {
		const { userId, starred } = get()
		const next = starred.includes(boardId) ? starred.filter((id) => id !== boardId) : [boardId, ...starred]
		set({ starred: next })
		if (userId) write(keys(userId).starred, next)
	},

	markOpened: (boardId) => {
		const { userId, recent } = get()
		if (!boardId) return
		const next = [{ id: boardId, at: Date.now() }, ...recent.filter((entry) => entry.id !== boardId)].slice(0, MAX_RECENT)
		set({ recent: next })
		if (userId) write(keys(userId).recent, next)
	},

	// Replaces the whole history: [] clears it, the previous list undoes that.
	setRecent: (next) => {
		const { userId } = get()
		set({ recent: next })
		if (userId) write(keys(userId).recent, next)
	},
}))
