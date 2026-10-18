import { env } from '../config/env.js'

// Board backgrounds: a fixed palette of gradients and colours, and photos. With
// UNSPLASH_ACCESS_KEY photos come from Unsplash; without it, a curated set of Unsplash
// photos, then endless Unsplash photos from Picsum, and any search from Wikimedia
// Commons' quality images. Every source needs no key and credits the author.
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

const PAGE_SIZE = 20
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
	source: 'Unsplash',
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
	source: 'Unsplash',
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

const PICSUM_HOST = 'picsum.photos'
const COMMONS_HOSTS = ['upload.wikimedia.org', 'thumb.wikimedia.org']
const USER_AGENT = 'KanbanHub/1.0 (board backgrounds; https://github.com/danik3422/kanban-flow)'

const cached = async (key, load) => {
	const hit = cache.get(key)
	if (hit && hit.at > Date.now() - CACHE_MS) return hit.value
	const value = await load()
	cache.set(key, { at: Date.now(), value })
	if (cache.size > 500) cache.delete(cache.keys().next().value)
	return value
}

const getJson = async (url) => {
	const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, signal: AbortSignal.timeout(8000) })
	if (!response.ok) throw new Error(`${new URL(url).hostname} ${response.status}`)
	return response.json()
}

// Picsum serves Unsplash photos by number, with the photographer's name.
const picsumPhoto = (photo) => ({
	id: `picsum-${photo.id}`,
	url: `https://${PICSUM_HOST}/id/${photo.id}/2400/1350`,
	thumb: `https://${PICSUM_HOST}/id/${photo.id}/400/240`,
	color: '#5b6470',
	author: String(photo.author || '').slice(0, 80),
	authorUrl: /^https:\/\/unsplash\.com\//.test(photo.url || '') ? `${photo.url}?utm_source=kanbanhub&utm_medium=referral` : 'https://unsplash.com',
	source: 'Unsplash',
})

const browsePicsum = (page) => cached(`picsum|${page}`, async () => {
	const list = await getJson(`https://${PICSUM_HOST}/v2/list?page=${page}&limit=${PAGE_SIZE}`)
	// Wide photos only: they are backgrounds for a board.
	return { photos: list.filter((photo) => photo.width >= photo.height * 1.2).map(picsumPhoto), hasMore: list.length === PAGE_SIZE }
})

const stripHtml = (value = '') => String(value).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()

// Commons thumbnails come in fixed widths; the same file at two of them.
const commonsSized = (thumbUrl, width) => thumbUrl.replace(/\/(\d+)px-([^/]+)$/, `/${width}px-$2`)

const commonsPhoto = (page) => {
	const info = page.imageinfo?.[0]
	if (!info?.thumburl) return null
	const meta = info.extmetadata || {}
	return {
		id: `commons-${page.pageid}`,
		url: info.thumburl,
		thumb: commonsSized(info.thumburl, 500),
		color: '#5b6470',
		author: stripHtml(meta.Artist?.value).slice(0, 80) || 'Wikimedia Commons',
		authorUrl: info.descriptionurl || 'https://commons.wikimedia.org',
		license: stripHtml(meta.LicenseShortName?.value).slice(0, 40),
		source: 'Wikimedia Commons',
	}
}

// Ukrainian and Russian topic words searched in English, where Commons has most photos.
const englishQuery = (query) => query.toLowerCase().split(/\s+/).filter(Boolean).map((word) => {
	const topic = Object.entries(TOPICS).find(([name, terms]) => name === word || terms.some((term) => term === word || (word.length > 3 && term.startsWith(word))))
	return topic ? topic[0] : word
}).join(' ')

const searchCommons = (query, page) => cached(`commons|${query}|${page}`, async () => {
	const search = `${englishQuery(query)} filetype:bitmap filew:>1900 incategory:Quality_images`
	const params = new URLSearchParams({
		action: 'query',
		format: 'json',
		generator: 'search',
		gsrnamespace: '6',
		gsrsearch: search,
		gsrlimit: String(PAGE_SIZE + 10),
		gsroffset: String((page - 1) * (PAGE_SIZE + 10)),
		prop: 'imageinfo',
		iiprop: 'url|size|extmetadata',
		iiextmetadatafilter: 'Artist|LicenseShortName',
		iiurlwidth: '1920',
	})
	const body = await getJson(`https://commons.wikimedia.org/w/api.php?${params}`)
	const pages = Object.values(body.query?.pages || {}).sort((a, b) => (a.index || 0) - (b.index || 0))
	const wide = pages.filter((item) => item.imageinfo?.[0] && item.imageinfo[0].width >= item.imageinfo[0].height * 1.2)
	return { photos: wide.map(commonsPhoto).filter(Boolean), hasMore: Boolean(body.continue) }
})

const curatedCount = (query) => (query ? CURATED.filter((entry) => matchesQuery(entry, query)).length : CURATED.length)

/**
 * The keyless sources, page by page: the curated photos first (all of them, or the
 * ones matching the search), then Picsum to browse or Commons to search, endlessly.
 */
const searchKeyless = async (query, page) => {
	const curatedPages = Math.ceil(curatedCount(query) / PAGE_SIZE)
	if (page <= curatedPages) {
		const curated = searchCurated(query, page)
		return { source: 'curated', photos: curated.photos, hasMore: true }
	}
	const remotePage = page - curatedPages
	try {
		const remote = query ? await searchCommons(query, remotePage) : await browsePicsum(remotePage)
		return { source: query ? 'commons' : 'picsum', ...remote }
	} catch (error) {
		console.error('Background photo source failed:', error.message)
		return { source: 'curated', photos: [], hasMore: false }
	}
}

/** Photos for the picker: Unsplash when configured (falling back on errors), else the keyless sources. */
export const searchBackgroundPhotos = async ({ query = '', page = 1 } = {}) => {
	const cleanQuery = String(query).trim().slice(0, 60)
	const cleanPage = Math.max(1, Math.min(60, Number(page) || 1))
	if (env.unsplashAccessKey) {
		try {
			return await searchUnsplash(cleanQuery, cleanPage)
		} catch (error) {
			console.error('Unsplash search failed, using the other sources:', error.message)
		}
	}
	return searchKeyless(cleanQuery, cleanPage)
}

const isHttpsUrl = (value, host) => {
	try {
		const url = new URL(value)
		return url.protocol === 'https:' && url.hostname === host
	} catch {
		return false
	}
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
		if (curated) return { type: 'photo', id: curated.id, url: curated.url, thumb: curated.thumb, color: curated.color, author: '', authorUrl: curated.authorUrl, source: 'Unsplash' }
		const picsum = /^picsum-(\d{1,6})$/.exec(input.id || '')
		if (picsum) {
			return {
				type: 'photo',
				...picsumPhoto({ id: picsum[1], author: input.author, url: isHttpsUrl(input.authorUrl, 'unsplash.com') ? input.authorUrl.split('?')[0] : '' }),
			}
		}
		if (/^commons-\d{1,12}$/.test(input.id || '') && COMMONS_HOSTS.some((host) => isHttpsUrl(input.url, host)) && COMMONS_HOSTS.some((host) => isHttpsUrl(input.thumb, host))) {
			return {
				type: 'photo',
				id: input.id,
				url: input.url,
				thumb: input.thumb,
				color: '#5b6470',
				author: String(input.author || '').slice(0, 80),
				authorUrl: isHttpsUrl(input.authorUrl, 'commons.wikimedia.org') ? input.authorUrl : 'https://commons.wikimedia.org',
				license: String(input.license || '').slice(0, 40),
				source: 'Wikimedia Commons',
			}
		}
		if (env.unsplashAccessKey && /^unsplash-[\w-]{1,40}$/.test(input.id || '') && isUnsplashUrl(input.url) && isUnsplashUrl(input.thumb)) {
			return {
				type: 'photo',
				id: input.id,
				url: input.url,
				thumb: input.thumb,
				color: /^#[0-9a-f]{6}$/i.test(input.color || '') ? input.color : '#5b6470',
				author: String(input.author || '').slice(0, 80),
				authorUrl: isUnsplashUrl(input.authorUrl, 'unsplash.com') ? input.authorUrl : 'https://unsplash.com',
				source: 'Unsplash',
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
