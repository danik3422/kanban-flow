import { env } from '../config/env.js'

// Board backgrounds: a fixed palette of gradients and colours, a curated set of
// Unsplash photos that always works, and (with UNSPLASH_ACCESS_KEY) Unsplash search.
// The frontend draws the palette from the same keys (frontend/src/utils/boardBackground.js).

export const GRADIENT_KEYS = ['midnight', 'ocean', 'sapphire', 'dusk', 'lavender', 'sunset', 'blossom', 'lagoon', 'slate', 'ember']
export const COLOR_KEYS = ['blue', 'orange', 'green', 'red', 'purple', 'pink', 'lime', 'sky', 'gray']

// Topic words in every interface language, so curated search works for everyone.
const TOPICS = {
	mountains: ['mountain', 'mountains', 'peak', 'alps', 'горы', 'гора', 'гори', 'вершина'],
	sea: ['sea', 'ocean', 'beach', 'water', 'coast', 'море', 'океан', 'пляж', 'вода', 'берег'],
	lake: ['lake', 'water', 'reflection', 'озеро', 'вода', 'отражение', 'відображення'],
	city: ['city', 'urban', 'skyline', 'street', 'город', 'місто', 'улица', 'вулиця', 'небоскрёб', 'хмарочос'],
	forest: ['forest', 'trees', 'woods', 'лес', 'ліс', 'деревья', 'дерева'],
	nature: ['nature', 'landscape', 'green', 'природа', 'пейзаж', 'зелень'],
	space: ['space', 'earth', 'planet', 'galaxy', 'cosmos', 'космос', 'земля', 'планета', 'галактика'],
	night: ['night', 'stars', 'dark', 'ночь', 'ніч', 'звёзды', 'зірки', 'тёмный', 'темний'],
	sunset: ['sunset', 'sunrise', 'dawn', 'golden', 'закат', 'захід', 'рассвет', 'світанок'],
	flowers: ['flowers', 'flower', 'field', 'spring', 'цветы', 'квіти', 'поле', 'весна'],
	abstract: ['abstract', 'colorful', 'bokeh', 'texture', 'абстракция', 'абстракція', 'яркий', 'яскравий'],
	clouds: ['clouds', 'sky', 'fog', 'mist', 'облака', 'хмари', 'небо', 'туман'],
	autumn: ['autumn', 'fall', 'orange', 'осень', 'осінь'],
}

// id, average colour (placeholder while loading), topics.
const CURATED = [
	['1506905925346-21bda4d32df4', '#666679', ['mountains', 'clouds', 'sunset']],
	['1469474968028-56623f02e42e', '#706a51', ['mountains', 'nature', 'sunset']],
	['1501785888041-af3ef285b470', '#71938a', ['lake', 'mountains', 'nature']],
	['1470071459604-3b5ec3a7fe05', '#6c7166', ['nature', 'clouds', 'sunset']],
	['1441974231531-c6227db76b6e', '#524d38', ['forest', 'nature']],
	['1500530855697-b586d89ba3ee', '#716666', ['mountains', 'nature']],
	['1507525428034-b723cf961d3e', '#bcb9b4', ['sea', 'sunset']],
	['1519681393784-d120267933ba', '#3e4b68', ['mountains', 'night', 'space']],
	['1475924156734-496f6cac6ec1', '#8292bc', ['sea', 'sunset', 'clouds']],
	['1464822759023-fed622ff2c3b', '#606e71', ['mountains', 'forest', 'nature']],
	['1493246507139-91e8fad9978e', '#665d5f', ['lake', 'mountains', 'sunset']],
	['1477959858617-67f85cf4f1df', '#727a89', ['city']],
	['1449824913935-59a10b8d2000', '#65696e', ['city']],
	['1480714378408-67cf0d13bc1b', '#888584', ['city', 'sunset']],
	['1502082553048-f009c37129b9', '#96a189', ['nature', 'forest']],
	['1433086966358-54859d0ed716', '#5c6a44', ['nature', 'forest']],
	['1472214103451-9374bd1c798e', '#677940', ['nature', 'sunset']],
	['1418065460487-3e41a6c84dc5', '#929894', ['forest', 'clouds']],
	['1446776811953-b23d57bd21aa', '#7b8693', ['space', 'clouds']],
	['1462331940025-496dfbfc7564', '#363a47', ['space', 'abstract', 'night']],
	['1451187580459-43490279c0fa', '#181920', ['space', 'night', 'city']],
	['1534447677768-be436bb09401', '#2d3643', ['night', 'space', 'sea']],
	['1513151233558-d860c5398176', '#1d8ca0', ['abstract']],
	['1490750967868-88aa4486c946', '#788e70', ['flowers', 'nature']],
	['1508739773434-c26b3d09e071', '#667c80', ['mountains', 'sunset']],
	['1494500764479-0c8f2919a3d8', '#8572b7', ['lake', 'sunset', 'nature']],
	['1505765050516-f72dcac9c60e', '#9fa1a8', ['mountains', 'clouds']],
	['1511300636408-a63a89df3482', '#5e5886', ['mountains', 'sea', 'sunset']],
	['1504608524841-42fe6f032b4b', '#2c2f2f', ['clouds', 'sunset']],
	['1470770841072-f978cf4d019e', '#747a77', ['lake', 'mountains', 'forest']],
	['1426604966848-d7adac402bff', '#666257', ['mountains', 'forest', 'nature']],
	['1447752875215-b2761acb3c5d', '#3d4031', ['forest', 'nature']],
	['1500964757637-c85e8a162699', '#b49a86', ['mountains', 'sunset', 'clouds']],
	['1488866022504-f2584929ca5f', '#233046', ['night', 'space']],
	['1496442226666-8d4d0e62e6e9', '#5b4d50', ['city']],
	['1444723121867-7a241cacace9', '#32415d', ['city', 'night']],
	['1515694346937-94d85e41e6f0', '#70718a', ['abstract']],
	['1499002238440-d264edd596ec', '#9f6f7d', ['flowers', 'sunset']],
	['1523712999610-f77fbcfc3843', '#9f6640', ['forest', 'autumn', 'sunset']],
]

const PAGE_SIZE = 18
// Unsplash's largest page: fewer requests against its hourly limit.
const UNSPLASH_PAGE_SIZE = 30
const UNSPLASH_IMAGE_HOST = 'images.unsplash.com'

const curatedPhoto = ([id, color]) => ({
	id: `curated-${id}`,
	url: `https://${UNSPLASH_IMAGE_HOST}/photo-${id}?auto=format&fit=crop&w=2400&q=80`,
	thumb: `https://${UNSPLASH_IMAGE_HOST}/photo-${id}?auto=format&fit=crop&w=400&h=240&q=60`,
	color,
	author: '',
	authorUrl: 'https://unsplash.com/?utm_source=kanbanhub&utm_medium=referral',
})

const CURATED_BY_ID = new Map(CURATED.map((entry) => [`curated-${entry[0]}`, curatedPhoto(entry)]))

const matchesQuery = ([, , topics], query) => {
	const words = query.toLowerCase().split(/\s+/).filter(Boolean)
	return words.every((word) => topics.some((topic) => topic.startsWith(word) || TOPICS[topic].some((term) => term.startsWith(word))))
}

const searchCurated = (query, page) => {
	const matches = query ? CURATED.filter((entry) => matchesQuery(entry, query)) : CURATED
	const start = (page - 1) * PAGE_SIZE
	return { source: 'curated', photos: matches.slice(start, start + PAGE_SIZE).map(curatedPhoto), hasMore: start + PAGE_SIZE < matches.length }
}

// Unsplash answers are cached briefly: the demo tier allows 50 requests an hour.
const cache = new Map()
const CACHE_MS = 10 * 60 * 1000

const fromUnsplash = (photo) => ({
	id: `unsplash-${photo.id}`,
	url: `${photo.urls.raw}&auto=format&fit=crop&w=2400&q=80`,
	thumb: `${photo.urls.raw}&auto=format&fit=crop&w=400&h=240&q=60`,
	color: /^#[0-9a-f]{6}$/i.test(photo.color || '') ? photo.color : '#5b6470',
	author: photo.user?.name || '',
	authorUrl: `${photo.user?.links?.html || 'https://unsplash.com'}?utm_source=kanbanhub&utm_medium=referral`,
	downloadLocation: photo.links?.download_location || '',
})

const searchUnsplash = async (query, page) => {
	const key = `${query}|${page}`
	const cached = cache.get(key)
	if (cached && cached.at > Date.now() - CACHE_MS) return cached.value
	const url = query
		? `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&page=${page}&per_page=${UNSPLASH_PAGE_SIZE}&orientation=landscape&content_filter=high`
		: `https://api.unsplash.com/topics/wallpapers/photos?page=${page}&per_page=${UNSPLASH_PAGE_SIZE}&orientation=landscape`
	const response = await fetch(url, { headers: { Authorization: `Client-ID ${env.unsplashAccessKey}`, 'Accept-Version': 'v1' }, signal: AbortSignal.timeout(6000) })
	if (!response.ok) throw new Error(`Unsplash ${response.status}`)
	const body = await response.json()
	const results = Array.isArray(body) ? body : body.results || []
	const value = { source: 'unsplash', photos: results.map(fromUnsplash), hasMore: Array.isArray(body) ? results.length === UNSPLASH_PAGE_SIZE : page < (body.total_pages || 0) }
	cache.set(key, { at: Date.now(), value })
	return value
}

/** Photos for the picker: Unsplash when configured (falling back on errors), else the curated set. */
export const searchBackgroundPhotos = async ({ query = '', page = 1 } = {}) => {
	const cleanQuery = String(query).trim().slice(0, 60)
	const cleanPage = Math.max(1, Math.min(50, Number(page) || 1))
	if (env.unsplashAccessKey) {
		try {
			return await searchUnsplash(cleanQuery, cleanPage)
		} catch (error) {
			console.error('Unsplash search failed, using the curated photos:', error.message)
		}
	}
	return searchCurated(cleanQuery, cleanPage)
}

const isUnsplashUrl = (value, host = UNSPLASH_IMAGE_HOST) => {
	try {
		const url = new URL(value)
		return url.protocol === 'https:' && url.hostname === host
	} catch {
		return false
	}
}

/**
 * Turns what the client sent into what is stored, or throws for anything that is
 * not from our palette, our curated set or (when enabled) Unsplash itself.
 */
export const normalizeBackground = (input) => {
	if (input === null) return null
	if (input.type === 'gradient' && GRADIENT_KEYS.includes(input.key)) return { type: 'gradient', key: input.key }
	if (input.type === 'color' && COLOR_KEYS.includes(input.key)) return { type: 'color', key: input.key }
	if (input.type === 'photo') {
		const curated = CURATED_BY_ID.get(input.id)
		if (curated) return { type: 'photo', id: curated.id, url: curated.url, thumb: curated.thumb, color: curated.color, author: '', authorUrl: curated.authorUrl }
		if (env.unsplashAccessKey && /^unsplash-[\w-]{1,40}$/.test(input.id || '') && isUnsplashUrl(input.url) && isUnsplashUrl(input.thumb)) {
			return {
				type: 'photo',
				id: input.id,
				url: input.url,
				thumb: input.thumb,
				color: /^#[0-9a-f]{6}$/i.test(input.color || '') ? input.color : '#5b6470',
				author: String(input.author || '').slice(0, 80),
				authorUrl: isUnsplashUrl(input.authorUrl, 'unsplash.com') ? input.authorUrl : 'https://unsplash.com',
			}
		}
	}
	const error = new Error('Choose a background from the list.')
	error.statusCode = 400
	throw error
}

// Unsplash asks apps to report when a photo is actually used.
export const reportUnsplashUse = (input) => {
	if (!env.unsplashAccessKey || !input?.downloadLocation || !isUnsplashUrl(input.downloadLocation, 'api.unsplash.com')) return
	fetch(input.downloadLocation, { headers: { Authorization: `Client-ID ${env.unsplashAccessKey}` }, signal: AbortSignal.timeout(6000) }).catch(() => {})
}
