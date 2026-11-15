// Pure translation helpers, shared by the React provider and the tests.
import en from './locales/en.js'

// English ships with the app and fills any gap; Ukrainian and Russian are separate files
// fetched when someone uses them, so nobody downloads two languages they never read.
export const LOCALES = { en }
const LOADERS = {
	uk: () => import('./locales/uk.js'),
	ru: () => import('./locales/ru.js'),
}
const loading = {}

export const isLanguageLoaded = (language) => Boolean(LOCALES[normalizeLanguage(language) || 'en'])

/** Makes a language's messages available; resolves at once when they already are. */
export const loadLanguage = async (language) => {
	const lang = normalizeLanguage(language) || 'en'
	if (LOCALES[lang]) return
	loading[lang] ||= LOADERS[lang]().then((module) => {
		LOCALES[lang] = module.default
	}).finally(() => {
		delete loading[lang]
	})
	await loading[lang]
}
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
	let value = LOCALES[lang] ? lookup(LOCALES[lang], key) : undefined
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
	if (message && LOCALES[lang]?.server?.[message]) return LOCALES[lang].server[message]
	if (message && lang === 'en') return message
	return translate(lang, fallbackKey)
}

// For code outside React (stores, toasts): the provider keeps <html lang> in sync
// with the active language.
export const activeLanguage = () => normalizeLanguage(typeof document === 'undefined' ? 'en' : document.documentElement.lang) || 'en'
export const translateCurrent = (key, vars) => translate(activeLanguage(), key, vars)
export const translateServerMessageCurrent = (message, fallbackKey) =>
	translateServerMessage(activeLanguage(), message, fallbackKey)
