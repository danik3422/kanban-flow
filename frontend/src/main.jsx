import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './app/App.jsx'
import ErrorBoundary from './app/ErrorBoundary.jsx'
import '@fontsource-variable/onest'
import './styles/reset.css'
import './styles/global.css'
import './ui'
import { I18nProvider } from './i18n'
import { initApiCache } from './lib/apiCache.js'
import { registerServiceWorker } from './lib/serviceWorker.js'
import { loadServerConfig } from './lib/serverConfig.js'
import { applyThemeFromStorage } from './lib/theme.js'

applyThemeFromStorage()

// Saved answers load first (a few milliseconds), so pages can draw from them in their first frame.
// Never wait more than a moment: a slow disk must not delay the app itself.
const cacheReady = Promise.race([initApiCache(), new Promise((resolve) => setTimeout(resolve, 400))])
cacheReady.catch(() => {}).finally(() => createRoot(document.getElementById('root')).render(
	<StrictMode>
		<ErrorBoundary>
			<BrowserRouter>
				<I18nProvider>
					<App />
				</I18nProvider>
			</BrowserRouter>
		</ErrorBoundary>
	</StrictMode>
))

registerServiceWorker()
loadServerConfig()
