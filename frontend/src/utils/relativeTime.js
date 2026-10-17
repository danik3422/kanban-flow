import { intlLocale } from '../i18n/translate'

const UNITS = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]]

/** "2 hours ago", "yesterday"… in the interface language; under a minute returns `justNow`. */
export const relativeTime = (date, language, justNow) => {
	if (!date) return ''
	const seconds = (new Date(date).getTime() - Date.now()) / 1000
	if (Math.abs(seconds) < 60) return justNow
	const format = new Intl.RelativeTimeFormat(intlLocale(language), { numeric: 'auto' })
	for (const [unit, size] of UNITS) {
		if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit)
	}
	return justNow
}
