import { ArrowLeft, ArrowRight, Compass, SearchX } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/useAuthStore'
import SiteFooter from '../components/SiteFooter'

const NotFound = () => {
	const authUser = useAuthStore((state) => state.authUser)
	const destination = authUser ? '/workspaces' : '/'

	return (
		<div className='not-found-shell'>
			<main className='not-found-page'>
				<div className='not-found-layout'>
					<div className='not-found-mark'><SearchX size={28} /></div>
					<p className='eyebrow'>Error 404</p>
					<h1>This page took a wrong turn.</h1>
					<p className='not-found-copy'>The page you are looking for does not exist or may have moved. Let&apos;s get you back to something useful.</p>
					<div className='not-found-actions'>
						<Link to={destination} className='primary-button'><ArrowLeft size={16} /> {authUser ? 'Back to workspace' : 'Back home'}</Link>
					</div>
				</div>
			</main>
			<SiteFooter />
		</div>
	)
}

export default NotFound
