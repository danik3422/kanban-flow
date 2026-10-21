// Board backgrounds drawn from the keys the server accepts
// (backend/services/boardBackgrounds.service.js). Photos come from the server with their URLs.

export const GRADIENTS = {
	midnight: { css: 'linear-gradient(135deg, #1e2a4a 0%, #1b2f5e 100%)', color: '#1d2d54' },
	ocean: { css: 'linear-gradient(135deg, #2f6fe0 0%, #4bb3c9 100%)', color: '#3d91d4' },
	sapphire: { css: 'linear-gradient(135deg, #2563eb 0%, #1e3a8a 100%)', color: '#224eba' },
	dusk: { css: 'linear-gradient(135deg, #1e3a8a 0%, #9d4e9a 100%)', color: '#5e4492' },
	lavender: { css: 'linear-gradient(135deg, #7c5cc4 0%, #d978b6 100%)', color: '#aa6abd' },
	sunset: { css: 'linear-gradient(135deg, #d9543f 0%, #f0a650 100%)', color: '#e47d48' },
	blossom: { css: 'linear-gradient(135deg, #e07bb5 0%, #f08a6a 100%)', color: '#e8828f' },
	lagoon: { css: 'linear-gradient(135deg, #2f8a63 0%, #7cc4c4 100%)', color: '#55a793' },
	slate: { css: 'linear-gradient(135deg, #5b6885 0%, #1f2b4d 100%)', color: '#3d4969' },
	ember: { css: 'linear-gradient(135deg, #4a2a17 0%, #8f2d1f 100%)', color: '#6c2b1b' },
}

export const COLORS = {
	blue: '#3778c2',
	orange: '#c98f45',
	green: '#5f9748',
	red: '#a54e38',
	purple: '#84659b',
	pink: '#c0638c',
	lime: '#5aa463',
	sky: '#3f97b4',
	gray: '#6f7a80',
}

export const GRADIENT_KEYS = Object.keys(GRADIENTS)
export const COLOR_KEYS = Object.keys(COLORS)

/** The one colour that stands for a background: placeholders, tiles, tints. */
export const backgroundColorOf = (background) => {
	if (!background) return ''
	if (background.type === 'gradient') return GRADIENTS[background.key]?.color || ''
	if (background.type === 'color') return COLORS[background.key] || ''
	return background.color || '#5b6470'
}

/** CSS `background` for a board background; `thumb` uses the small photo. */
export const backgroundCss = (background, { thumb = false } = {}) => {
	if (!background) return ''
	if (background.type === 'gradient') return GRADIENTS[background.key]?.css || ''
	if (background.type === 'color') return COLORS[background.key] || ''
	const url = thumb ? background.thumb || background.url : background.url
	return url ? `${backgroundColorOf(background)} url("${encodeURI(decodeURI(url))}") center / cover no-repeat` : backgroundColorOf(background)
}

export const sameBackground = (a, b) => (a?.type === b?.type) && (a?.type === 'photo' ? a?.id === b?.id : a?.key === b?.key)

export const paletteBackground = (type, key) => ({ type, key })

/** What the server needs to store a background (it fills photo URLs itself for curated photos). */
export const backgroundPayload = (background) => {
	if (!background) return null
	if (background.type !== 'photo') return { type: background.type, key: background.key }
	const { id, url, thumb, color, author, authorUrl, downloadLocation, source, license } = background
	return Object.fromEntries(Object.entries({ type: 'photo', id, url, thumb, color, author, authorUrl, downloadLocation, source, license }).filter(([, value]) => value))
}
