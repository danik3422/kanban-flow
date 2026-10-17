import { create } from 'zustand'
import { axiosInstance } from '../lib/axios'

const FRESH_MS = 30_000

// Per-board numbers for the board list and the sidebar badge, shared by every page
// of the app shell so they are fetched once rather than by each component.
export const useBoardStats = create((set, get) => ({
	byBoard: {},
	loadedAt: 0,
	isLoading: false,

	load: async ({ force = false } = {}) => {
		const { loadedAt, isLoading } = get()
		if (isLoading || (!force && Date.now() - loadedAt < FRESH_MS)) return
		set({ isLoading: true })
		try {
			const { data } = await axiosInstance.get('/board/boards/overview')
			set({ byBoard: Object.fromEntries((Array.isArray(data) ? data : []).map((entry) => [entry.boardId, entry])), loadedAt: Date.now() })
		} catch {
			// The list still works without numbers; they appear on the next successful load.
		} finally {
			set({ isLoading: false })
		}
	},

	reset: () => set({ byBoard: {}, loadedAt: 0 }),
}))

export const selectMyOpenTasks = (state) => Object.values(state.byBoard).reduce((sum, entry) => sum + (entry.myTaskCount || 0), 0)
