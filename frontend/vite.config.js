import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'

// Files from public/ that the app shows on every page, stored by the service worker too.
const PUBLIC_SHELL = ['/favicon.ico', '/favicon-32.png', '/kanban-mark.svg', '/icon-192.png', '/site.webmanifest', '/avatar.png']

/**
 * Emits /sw.js next to the build: src/sw/serviceWorker.js with the list of built files
 * to store and a version that changes whenever any of them changes.
 */
const serviceWorker = () => ({
	name: 'kanban-service-worker',
	apply: 'build',
	generateBundle(_options, bundle) {
		const files = Object.keys(bundle).filter((file) => !file.endsWith('.map') && file !== 'sw.js')
		const precache = ['/', '/index.html', ...files.filter((file) => file !== 'index.html').map((file) => `/${file}`), ...PUBLIC_SHELL]
		const version = createHash('sha256').update(files.sort().join('|')).digest('hex').slice(0, 12)
		const template = readFileSync(new URL('./src/sw/serviceWorker.js', import.meta.url), 'utf8')
		this.emitFile({
			type: 'asset',
			fileName: 'sw.js',
			source: template
				.replace("const VERSION = 'dev'", `const VERSION = ${JSON.stringify(version)}`)
				.replace("const PRECACHE = ['/']", `const PRECACHE = ${JSON.stringify(precache)}`),
		})
	},
})

// https://vite.dev/config/
export default defineConfig({
	plugins: [react(), serviceWorker()],
})
