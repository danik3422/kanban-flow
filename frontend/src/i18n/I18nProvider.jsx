import { useCallback, useEffect, useMemo, useState } from 'react'
import { axiosInstance } from '../lib/axios'
import { useAuthStore } from '../store/useAuthStore'
import { I18nContext, buildI18nValue } from './context'
import { normalizeLanguage } from './translate'

const STORAGE_KEY = 'kanban-language'

const readStoredLanguage = () => {
	try {
		return normalizeLanguage(localStorage.getItem(STORAGE_KEY))
	} catch {
		return null
	}
}

// Before sign-in: the choice made on this device, else the browser's language.
const detectLanguage = () =>
	readStoredLanguage() ||
	(typeof navigator !== 'undefined' && (navigator.languages || [navigator.language]).map(normalizeLanguage).find(Boolean)) ||
	'en'

const I18nProvider = ({ children }) => {
	const accountLanguage = useAuthStore((state) => normalizeLanguage(state.authUser?.language))
	const [deviceLanguage, setDeviceLanguage] = useState(detectLanguage)
	// A signed-in account's saved language wins so it follows the user across devices.
	const language = accountLanguage || deviceLanguage

	useEffect(() => {
		document.documentElement.lang = language
	}, [language])

	const setLanguage = useCallback(async (next) => {
		const nextLanguage = normalizeLanguage(next)
		if (!nextLanguage) return
		try {
			localStorage.setItem(STORAGE_KEY, nextLanguage)
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
