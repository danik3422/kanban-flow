// Pure translation helpers, shared by the React provider and the tests.
import en from './locales/en.js'
import ru from './locales/ru.js'
import uk from './locales/uk.js'

export const LOCALES = { en, uk, ru }
export const SUPPORTED_LANGUAGES = ['en', 'uk', 'ru']
export const LANGUAGE_NAMES = { en: 'English', uk: 'Українська', ru: 'Русский' }
const INTL_LOCALE = { en: 'en-GB', uk: 'uk-UA', ru: 'ru-RU' }

export const normalizeLanguage = (value) => {
	const code = String(value || '').toLowerCase().slice(0, 2)
	return SUPPORTED_LANGUAGES.includes(code) ? code : null
}

const lookup = (messages, key) => key.split('.').reduce((node, part) => (node == null ? undefined : node[part]), messages)

// Plural messages are objects keyed by Intl.PluralRules categories (one, few, many, other).
const pickPlural = (value, language, count) => {
	if (value === null || typeof value !== 'object') return value
	const category = new Intl.PluralRules(INTL_LOCALE[language]).select(Number(count) || 0)
	return value[category] ?? value.other
}

export const translate = (language, key, vars = {}) => {
	const lang = normalizeLanguage(language) || 'en'
	let value = lookup(LOCALES[lang], key)
	if (value === undefined) value = lookup(LOCALES.en, key)
	if (value === undefined) return key
	value = pickPlural(value, lang, vars.count)
	if (typeof value !== 'string') return key
	return value.replace(/\{(\w+)\}/g, (match, name) => (vars[name] === undefined ? match : String(vars[name])))
}

export const intlLocale = (language) => INTL_LOCALE[normalizeLanguage(language) || 'en']

// The API answers in English; show known messages in the user's language and fall
// back to a translated generic message for unknown ones.
export const translateServerMessage = (language, message, fallbackKey = 'auth.errors.generic') => {
	const lang = normalizeLanguage(language) || 'en'
	if (message && LOCALES[lang].server?.[message]) return LOCALES[lang].server[message]
	if (message && lang === 'en') return message
	return translate(lang, fallbackKey)
}

// For code outside React (stores, toasts): the provider keeps <html lang> in sync
// with the active language.
const activeLanguage = () => (typeof document === 'undefined' ? 'en' : document.documentElement.lang)
export const translateCurrent = (key, vars) => translate(activeLanguage(), key, vars)
export const translateServerMessageCurrent = (message, fallbackKey) =>
	translateServerMessage(activeLanguage(), message, fallbackKey)
