import { useCallback, useEffect, useMemo, useState } from 'react'
import { axiosInstance } from '../lib/axios'
import { useAuthStore } from '../store/useAuthStore'
import { I18nContext, buildI18nValue } from './context'
import { detectLanguage, LANGUAGE_STORAGE_KEY } from './detect'
import { isLanguageLoaded, loadLanguage, normalizeLanguage } from './translate'

const I18nProvider = ({ children }) => {
	const accountLanguage = useAuthStore((state) => normalizeLanguage(state.authUser?.language))
	const [deviceLanguage, setDeviceLanguage] = useState(detectLanguage)
	// A signed-in account's saved language wins so it follows the user across devices.
	const wanted = accountLanguage || deviceLanguage
	// The language on screen: the wanted one once its messages have arrived, until then
	// the one already showing (usually only a moment, and only on a first switch).
	const [language, setShownLanguage] = useState(() => (isLanguageLoaded(wanted) ? wanted : 'en'))

	useEffect(() => {
		let current = true
		loadLanguage(wanted)
			.then(() => {
				if (current) setShownLanguage(wanted)
			})
			.catch(() => {
				// Offline before the file was ever fetched: stay in the language already showing.
			})
		return () => {
			current = false
		}
	}, [wanted])

	useEffect(() => {
		document.documentElement.lang = language
	}, [language])

	const setLanguage = useCallback(async (next) => {
		const nextLanguage = normalizeLanguage(next)
		if (!nextLanguage) return
		try {
			localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage)
		} catch {
			// The choice still applies for this visit.
		}
		setDeviceLanguage(nextLanguage)
		const { authUser } = useAuthStore.getState()
		if (!authUser) return
		useAuthStore.setState({ authUser: { ...authUser, language: nextLanguage } })
		try {
			await axiosInstance.patch('/auth/settings', { language: nextLanguage })
		} catch {
			// Keep the interface in the chosen language even if saving it failed.
		}
	}, [])

	const value = useMemo(() => buildI18nValue(language, setLanguage), [language, setLanguage])
	return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export default I18nProvider
