// The guide's texts, one chunk per language: a reader downloads only the one they read.
// The router starts loading them together with the page (see app/App.jsx), so opening
// /guide waits for one round trip, not two.

const LOADERS = {
	en: () => import('./content/en'),
	uk: () => import('./content/uk'),
	ru: () => import('./content/ru'),
}
const loading = {}

/** The guide's texts in a language (English when there is none), as one stable promise for `use()`. */
export const guideContentFor = (language) => {
	const key = LOADERS[language] ? language : 'en'
	loading[key] ??= LOADERS[key]().then((module) => module.default)
	return loading[key]
}

/** Starts loading the texts in the page's current language. */
export const preloadGuideContent = () => {
	if (typeof document !== 'undefined') void guideContentFor(document.documentElement.lang)
}
