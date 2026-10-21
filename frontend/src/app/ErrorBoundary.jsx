import { RotateCcw, TriangleAlert } from 'lucide-react'
import { Component } from 'react'
import { translateCurrent as t } from '../i18n/translate'
import { Button, EmptyState } from '../ui'
import './error-boundary.css'

// Keeps one broken widget from blanking the whole app. It sits outside the i18n
// provider, so it reads the current language directly.
class ErrorBoundary extends Component {
	state = { error: null }

	static getDerivedStateFromError(error) {
		return { error }
	}

	componentDidCatch(error, info) {
		console.error('Unhandled UI error:', error, info.componentStack)
	}

	render() {
		if (!this.state.error) return this.props.children

		return (
			<main className='error-boundary'>
				<EmptyState
					icon={TriangleAlert}
					tone='danger'
					title={t('errorBoundary.title')}
					description={t('errorBoundary.text')}
					action={<Button icon={RotateCcw} onClick={() => window.location.reload()}>{t('errorBoundary.reload')}</Button>}
				/>
			</main>
		)
	}
}

export default ErrorBoundary
