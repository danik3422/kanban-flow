import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './app/App.jsx'
import ErrorBoundary from './app/ErrorBoundary.jsx'
import './styles/reset.css'
import './styles/global.css'
import './ui'
import { I18nProvider } from './i18n'
import { applyThemeFromStorage } from './lib/theme.js'

applyThemeFromStorage()

createRoot(document.getElementById('root')).render(
	<StrictMode>
		<ErrorBoundary>
			<BrowserRouter>
				<I18nProvider>
					<App />
				</I18nProvider>
			</BrowserRouter>
		</ErrorBoundary>
	</StrictMode>
)
