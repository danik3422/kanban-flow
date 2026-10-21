import { useEffect, useRef, useState } from 'react'
import { axiosInstance } from '../../../lib/axios'

/** Photos from the server, page by page: Unsplash with a key, else curated photos, Picsum and Wikimedia Commons. */
export const usePhotoSearch = (query, enabled = true) => {
	const [state, setState] = useState({ photos: [], page: 0, hasMore: false, source: 'curated', loading: false, failed: false })
	const requestId = useRef(0)

	const load = async (page, reset) => {
		const id = ++requestId.current
		setState((current) => ({ ...current, loading: true, failed: false, ...(reset ? { photos: [], page: 0 } : {}) }))
		try {
			const { data } = await axiosInstance.get('/board/backgrounds/photos', { params: { query: query || undefined, page } })
			if (id !== requestId.current) return
			setState((current) => ({
				photos: reset ? data.photos : [...current.photos, ...data.photos.filter((photo) => !current.photos.some((item) => item.id === photo.id))],
				page,
				hasMore: data.hasMore,
				source: data.source,
				loading: false,
				failed: false,
			}))
		} catch {
			if (id === requestId.current) setState((current) => ({ ...current, loading: false, failed: true }))
		}
	}

	useEffect(() => {
		if (!enabled) return undefined
		const timer = window.setTimeout(() => load(1, true), query ? 300 : 0)
		return () => window.clearTimeout(timer)
		// eslint-disable-next-line react-hooks/exhaustive-deps -- load is recreated each render; query and enabled drive it.
	}, [query, enabled])

	return { ...state, loadMore: () => !state.loading && state.hasMore && load(state.page + 1, false), retry: () => load(1, true) }
}
