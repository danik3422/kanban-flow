import { useSyncExternalStore } from 'react'

const PHONE_QUERY = '(max-width: 720px)'
const subscribe = (callback) => {
	const query = window.matchMedia(PHONE_QUERY)
	query.addEventListener('change', callback)
	return () => query.removeEventListener('change', callback)
}

/** True on phone-width screens; follows rotation and window resizing. */
const useIsPhone = () => useSyncExternalStore(subscribe, () => window.matchMedia(PHONE_QUERY).matches, () => false)

export default useIsPhone
