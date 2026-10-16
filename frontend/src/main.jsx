import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import './index.css'
import { applyThemeFromStorage } from './utils/theme.js'

applyThemeFromStorage()

createRoot(document.getElementById('root')).render(
	<StrictMode>
		<ErrorBoundary>
			<BrowserRouter>
				<App />
			</BrowserRouter>
		</ErrorBoundary>
	</StrictMode>
)
