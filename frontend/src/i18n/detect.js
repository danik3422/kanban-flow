import { normalizeLanguage } from './translate'

export const LANGUAGE_STORAGE_KEY = 'kanban-language'

const readStoredLanguage = () => {
	try {
		return normalizeLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY))
	} catch {
		return null
	}
}

// Before sign-in: the choice made on this device, else the browser's language.
export const detectLanguage = () =>
	readStoredLanguage() ||
	(typeof navigator !== 'undefined' && (navigator.languages || [navigator.language]).map(normalizeLanguage).find(Boolean)) ||
	'en'
