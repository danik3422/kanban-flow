import { RotateCcw, TriangleAlert } from 'lucide-react'
import { Component } from 'react'

// Keeps one broken widget from blanking the whole app.
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
			<div className='not-found-shell'>
				<main className='not-found-page'>
					<div className='not-found-layout'>
						<div className='not-found-mark'><TriangleAlert size={28} /></div>
						<p className='eyebrow'>Something went wrong</p>
						<h1>This screen could not be displayed.</h1>
						<p className='not-found-copy'>An unexpected error interrupted the page. Your boards are safe. Reload to try again.</p>
						<div className='not-found-actions'>
							<button type='button' className='primary-button' onClick={() => window.location.reload()}>
								<RotateCcw size={16} /> Reload page
							</button>
						</div>
					</div>
				</main>
			</div>
		)
	}
}

export default ErrorBoundary
