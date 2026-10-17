import { Fragment, createContext, createElement, useContext } from 'react'
import { intlLocale, translate } from './translate'

export const buildI18nValue = (language, setLanguage) => {
	const locale = intlLocale(language)
	return {
		language,
		setLanguage,
		t: (key, vars) => translate(language, key, vars),
		// Like t(), but {placeholders} can be React nodes, e.g. a <strong> email.
		tNode: (key, nodes = {}) =>
			translate(language, key)
				.split(/(\{\w+\})/)
				.map((part, index) => {
					const name = part.match(/^\{(\w+)\}$/)?.[1]
					return createElement(Fragment, { key: index }, name && nodes[name] !== undefined ? nodes[name] : part)
				}),
		formatDate: (value, options = { day: 'numeric', month: 'short' }) =>
			value ? new Intl.DateTimeFormat(locale, options).format(new Date(value)) : '',
		formatNumber: (value, options) => new Intl.NumberFormat(locale, options).format(value),
		locale,
	}
}

export const I18nContext = createContext(buildI18nValue('en', () => {}))

export const useI18n = () => useContext(I18nContext)
