// KanbanHub service worker. At build time vite.config.js replaces the VERSION and
// PRECACHE lines below with the build's version and its list of files.
//
// - The app (HTML, scripts, styles, icons) is stored on install, so it opens offline.
// - Pages: network first, the saved app page when there is no network.
// - Built files have content hashes in their names: served from the cache once stored.
// - Board pictures from photo sites: from the cache, refreshed in the background.
// - API answers are not touched here; the app keeps those itself, per account.

const VERSION = 'dev'
const PRECACHE = ['/']
const APP_CACHE = `kanban-app-${VERSION}`
const RUNTIME_CACHE = 'kanban-runtime'
const IMAGE_CACHE = 'kanban-images'
const MAX_IMAGES = 200
const NAVIGATION_TIMEOUT_MS = 4000

const IMAGE_HOSTS = ['res.cloudinary.com', 'images.unsplash.com', 'plus.unsplash.com', 'picsum.photos', 'fastly.picsum.photos', 'upload.wikimedia.org']

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(APP_CACHE)
			.then((cache) => cache.addAll(PRECACHE))
			.then(() => self.skipWaiting()),
	)
})

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys()
			.then((keys) => Promise.all(keys.filter((key) => key.startsWith('kanban-app-') && key !== APP_CACHE).map((key) => caches.delete(key))))
			.then(() => self.clients.claim()),
	)
})

const fromCache = (request) => caches.match(request, { ignoreSearch: false })

const trimCache = async (name, max) => {
	const cache = await caches.open(name)
	const keys = await cache.keys()
	await Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map((key) => cache.delete(key)))
}

const put = async (name, request, response) => {
	if (!response || (!response.ok && response.type !== 'opaque')) return
	const cache = await caches.open(name)
	await cache.put(request, response)
}

// Pages: the fresh page when the network answers in time, otherwise the saved one.
const handleNavigation = async (event) => {
	const timeout = new Promise((resolve) => setTimeout(resolve, NAVIGATION_TIMEOUT_MS))
	try {
		const network = fetch(event.request).then((response) => {
			if (response.ok) put(APP_CACHE, '/index.html', response.clone())
			return response
		})
		const response = await Promise.race([network, timeout])
		if (response) return response
		return (await caches.match('/index.html')) || (await network)
	} catch {
		return (await caches.match('/index.html')) || (await caches.match('/')) || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })
	}
}

const cacheFirst = async (request, cacheName) => {
	const cached = await fromCache(request)
	if (cached) return cached
	const response = await fetch(request)
	put(cacheName, request, response.clone())
	return response
}

const staleWhileRevalidate = async (event, cacheName, max) => {
	const cached = await fromCache(event.request)
	const network = fetch(event.request)
		.then(async (response) => {
			await put(cacheName, event.request, response.clone())
			if (max) await trimCache(cacheName, max)
			return response
		})
		.catch(() => cached)
	if (cached) {
		event.waitUntil(network)
		return cached
	}
	return network
}

self.addEventListener('fetch', (event) => {
	const { request } = event
	if (request.method !== 'GET') return
	const url = new URL(request.url)

	if (request.mode === 'navigate' && url.origin === self.location.origin) {
		event.respondWith(handleNavigation(event))
		return
	}
	if (url.origin === self.location.origin) {
		if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/') || url.pathname === '/sw.js') return
		if (url.pathname.startsWith('/assets/')) event.respondWith(cacheFirst(request, APP_CACHE))
		else event.respondWith(staleWhileRevalidate(event, RUNTIME_CACHE))
		return
	}
	if (IMAGE_HOSTS.includes(url.hostname) && request.destination === 'image') {
		event.respondWith(staleWhileRevalidate(event, IMAGE_CACHE, MAX_IMAGES))
	}
})
