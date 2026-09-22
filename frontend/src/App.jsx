import { lazy, Suspense, useEffect, useRef } from 'react'
import {
	Navigate,
	Route,
	Routes,
	useLocation,
	useNavigate,
} from 'react-router-dom'
import { Toaster } from 'sonner'

import Navbar from './components/Navbar'
import { axiosInstance } from './lib/axios'
const BoardInvite = lazy(() => import('./pages/BoardInvite'))
const CalendarPage = lazy(() => import('./pages/Calendar'))
const EditProfile = lazy(() => import('./pages/EditProfile'))
const Home = lazy(() => import('./pages/Home'))
const Login = lazy(() => import('./pages/Login'))
const MyTasks = lazy(() => import('./pages/MyTasks'))
const NotFound = lazy(() => import('./pages/NotFound'))
const Profile = lazy(() => import('./pages/Profile'))
const PublicBoard = lazy(() => import('./pages/PublicBoard'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const Settings = lazy(() => import('./pages/Settings'))
const SetupProfile = lazy(() => import('./pages/SetupProfile'))
const Signup = lazy(() => import('./pages/Signup'))
const Team = lazy(() => import('./pages/Team'))
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'))
const Workspace = lazy(() => import('./pages/Workspace'))
import { shouldBlockAccountGateRoute } from './lib/authRouteRules'
import { useAuthStore } from './store/useAuthStore'

export const App = () => {
	const location = useLocation()
	const navigate = useNavigate()
	const handledInviteRef = useRef(null)
	const isWorkspace =
		location.pathname.startsWith('/workspaces') ||
		location.pathname === '/my-tasks' ||
		location.pathname === '/team' ||
		location.pathname === '/calendar'
	const { authUser, checkAuth, completeSocialRedirect, isCheckingAuth } = useAuthStore()
	const loadingLabel = isWorkspace ? 'Loading workspace' : 'Loading'

	useEffect(() => {
		const publicRoute = location.pathname === '/' || location.pathname.startsWith('/public/') || location.pathname.startsWith('/invite/')
		const pageMeta = location.pathname.startsWith('/public/')
			? { title: 'Public board — KanbanHub', description: 'View a shared KanbanHub board.' }
			: location.pathname.startsWith('/invite/')
				? { title: 'Board invitation — KanbanHub', description: 'Join a KanbanHub workspace.' }
				: { title: 'KanbanHub — Make progress visible', description: 'A focused workspace for turning ideas into visible progress.' }
		document.title = pageMeta.title
		const description = document.querySelector('meta[name="description"]')
		const robots = document.querySelector('meta[name="robots"]')
		const canonical = document.querySelector('link[rel="canonical"]')
		if (description) description.setAttribute('content', pageMeta.description)
		if (robots) robots.setAttribute('content', publicRoute ? 'index,follow' : 'noindex,nofollow')
		if (canonical) canonical.setAttribute('href', `${window.location.origin}${publicRoute ? location.pathname : '/'}`)
	}, [location.pathname])

	useEffect(() => {
		checkAuth()
	}, [checkAuth])

	useEffect(() => {
		if (!authUser || !sessionStorage.getItem('pending-social-provider')) return
		completeSocialRedirect().then((result) => {
			if (result.success) checkAuth()
		})
	}, [authUser, checkAuth, completeSocialRedirect])

	useEffect(() => {
		const interceptorId = axiosInstance.interceptors.response.use(
			(response) => response,
			(error) => {
				const requestUrl = error.config?.url || ''
				const isAuthRequest = requestUrl.includes('/auth/')
				if (error.response?.status === 401 && !isAuthRequest) {
					useAuthStore.getState().clearAuth()
					const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`
					const isLoginPage = window.location.pathname === '/login'
					if (!isLoginPage) {
						navigate(`/login?redirect=${encodeURIComponent(currentUrl)}`, {
							replace: true,
						})
					}
				}
				return Promise.reject(error)
			},
		)

		return () => axiosInstance.interceptors.response.eject(interceptorId)
	}, [navigate])

	useEffect(() => {
		const inviteMatch = location.pathname.match(/^\/invite\/([^/?]+)/)
		const pendingInvite =
			localStorage.getItem('kanban-pending-invite') || inviteMatch?.[1]
		if (!authUser || !pendingInvite) return
		if (handledInviteRef.current === pendingInvite) return
		handledInviteRef.current = pendingInvite
		axiosInstance
			.post(`/board/invites/${pendingInvite}/accept`)
			.then(({ data }) => {
				localStorage.removeItem('kanban-pending-invite')
				navigate(`/workspaces/${data.boardId}`, { replace: true })
			})
			.catch((error) => {
				localStorage.removeItem('kanban-pending-invite')
				const message =
					error.response?.data?.message || 'This invite is no longer available'
				navigate(
					`/invite/${pendingInvite}?error=${encodeURIComponent(message)}`,
					{
						replace: true,
					},
				)
			})
	}, [authUser, location.pathname, navigate])

	const needsVerification = authUser && authUser.emailVerified === false
	const needsSetup = authUser && authUser.profileSetup === false && authUser.emailVerified === true
	const requestedRedirect = new URLSearchParams(location.search).get('redirect')
	const accountGateBlocked = shouldBlockAccountGateRoute(location.pathname, authUser)
	const loginRedirect =
		requestedRedirect?.startsWith('/') && !requestedRedirect.startsWith('//')
			? requestedRedirect
			: '/'

	if (isCheckingAuth) {
		return (
			<div className='loading-screen' role='status' aria-live='polite'>
				<div className='loading-shell' aria-label='Checking session'>
					<div className='loading-brand'>
						<span className='brand-mark'>K</span>
						<span>KanbanHub</span>
					</div>
					<div className='loading-pill'>
						<span className='loading-spinner' aria-hidden='true' />
						<p className='loading-label'>
							{loadingLabel}
							<span className='loading-dots'>...</span>
						</p>
					</div>
				</div>
			</div>
		)
	}

	return (
		<>
			<Toaster position='bottom-right' richColors />
			{!isWorkspace && <Navbar />}
			<Suspense fallback={<div className='loading-screen' role='status' aria-live='polite'><div className='loading-shell' aria-label='Loading page'><div className='loading-brand'><span className='brand-mark'>K</span><span>KanbanHub</span></div><div className='loading-pill'><span className='loading-spinner' aria-hidden='true' /><p className='loading-label'>Loading<span className='loading-dots'>...</span></p></div></div></div>}>
			<Routes key={location.pathname}>
				{needsVerification ? (
					<>
						<Route path='/verify-email' element={<VerifyEmail />} />
						<Route path='/login/verify-email' element={<VerifyEmail />} />
						<Route path='/login/resetpassword' element={<ResetPassword />} />
						<Route
							path='*'
							element={
								accountGateBlocked ? (
									<Navigate to='/verify-email' replace />
								) : (
									<VerifyEmail />
								)
							}
						/>
					</>
				) : needsSetup ? (
					<>
						<Route path='/setup-profile' element={<SetupProfile />} />
						<Route path='/login/resetpassword' element={<ResetPassword />} />
						<Route
							path='*'
							element={
								accountGateBlocked ? (
									<Navigate to='/setup-profile' replace />
								) : (
									<SetupProfile />
								)
							}
						/>
					</>
				) : (
					<>
						<Route path='/' element={<Home />} />
						<Route
							path='/login'
							element={
								!authUser ? <Login /> : <Navigate to={loginRedirect} replace />
							}
						/>
						<Route path='/invite/:token' element={<BoardInvite />} />
						<Route path='/public/:token' element={<PublicBoard />} />
						<Route
							path='/signup'
							element={!authUser ? <Signup /> : <Navigate to='/' replace />}
						/>
						<Route path='/login/resetpassword' element={<ResetPassword />} />
						<Route
							path='/login/verify-email'
							element={
								!authUser ? <VerifyEmail /> : <Navigate to='/' replace />
							}
						/>
						<Route
							path='/verify-email'
							element={<VerifyEmail />}
						/>

						<Route
							path='/workspaces'
							element={authUser ? <Workspace /> : <Navigate to='/' replace />}
						/>
						<Route
							path='/my-tasks'
							element={
								authUser ? <MyTasks /> : <Navigate to='/login' replace />
							}
						/>
						<Route
							path='/calendar'
							element={
								authUser ? <CalendarPage /> : <Navigate to='/login' replace />
							}
						/>
						<Route
							path='/team'
							element={authUser ? <Team /> : <Navigate to='/login' replace />}
						/>
						<Route
							path='/workspaces/:boardId'
							element={authUser ? <Workspace /> : <Navigate to='/' replace />}
						/>
						<Route
							path='/profile'
							element={
								authUser ? <Profile /> : <Navigate to='/login' replace />
							}
						/>
						<Route
							path='/profile/edit'
							element={
								authUser ? <EditProfile /> : <Navigate to='/login' replace />
							}
						/>
						<Route
							path='/settings'
							element={
								authUser ? <Settings /> : <Navigate to='/login' replace />
							}
						/>
						<Route path='*' element={<NotFound />} />
					</>
				)}
			</Routes>
			</Suspense>
		</>
	)
}

export default App
