import { ArrowLeft, ArrowRight, Compass, SearchX } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/useAuthStore'
import SiteFooter from '../components/SiteFooter'

const NotFound = () => {
	const authUser = useAuthStore((state) => state.authUser)
	const navigate = useNavigate()
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
						<Link to={destination} className='primary-button'><Compass size={17} /> {authUser ? 'Open workspace' : 'Back home'} <ArrowRight size={16} /></Link>
						<button type='button' onClick={() => navigate(-1)} className='quiet-button'><ArrowLeft size={16} /> Go back</button>
					</div>
				</div>
			</main>
			<SiteFooter />
		</div>
	)
}

export default NotFound
