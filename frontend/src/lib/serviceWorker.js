// The service worker (built from src/sw/serviceWorker.js) keeps the app itself on the
// device: the page, scripts, styles, fonts and pictures open even without a connection.
// Production only, so it never serves stale files while developing.
export const registerServiceWorker = () => {
	if (!import.meta.env.PROD || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
	window.addEventListener('load', () => {
		navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {})
	})
}
