import { lazy, Suspense, useEffect, useRef } from 'react'
import {
	Navigate,
	Route,
	Routes,
	useLocation,
	useNavigate,
} from 'react-router-dom'
import { Toaster } from 'sonner'

import AppLoader from './components/AppLoader'
import { axiosInstance } from './lib/axios'
// Page chunks, keyed so the one for the opened address can start downloading
// while the session is still being checked instead of after it.
const PAGES = {
	BoardInvite: () => import('./pages/BoardInvite'),
	Calendar: () => import('./pages/Calendar'),
	Home: () => import('./pages/Home'),
	Login: () => import('./pages/Login'),
	MyTasks: () => import('./pages/MyTasks'),
	NotFound: () => import('./pages/NotFound'),
	Profile: () => import('./pages/Profile'),
	PublicBoard: () => import('./pages/PublicBoard'),
	ResetPassword: () => import('./pages/ResetPassword'),
	Settings: () => import('./pages/Settings'),
	SetupProfile: () => import('./pages/SetupProfile'),
	Signup: () => import('./pages/Signup'),
	Team: () => import('./pages/Team'),
	VerifyEmail: () => import('./pages/VerifyEmail'),
	Workspace: () => import('./pages/Workspace'),
}
const BoardInvite = lazy(PAGES.BoardInvite)
const CalendarPage = lazy(PAGES.Calendar)
const Home = lazy(PAGES.Home)
const Login = lazy(PAGES.Login)
const MyTasks = lazy(PAGES.MyTasks)
const NotFound = lazy(PAGES.NotFound)
const Profile = lazy(PAGES.Profile)
const PublicBoard = lazy(PAGES.PublicBoard)
const ResetPassword = lazy(PAGES.ResetPassword)
const Settings = lazy(PAGES.Settings)
const SetupProfile = lazy(PAGES.SetupProfile)
const Signup = lazy(PAGES.Signup)
const Team = lazy(PAGES.Team)
const VerifyEmail = lazy(PAGES.VerifyEmail)
const Workspace = lazy(PAGES.Workspace)

const EXACT_PAGES = {
	'/': 'Home',
	'/login': 'Login',
	'/signup': 'Signup',
	'/login/resetpassword': 'ResetPassword',
	'/login/verify-email': 'VerifyEmail',
	'/verify-email': 'VerifyEmail',
	'/setup-profile': 'SetupProfile',
	'/workspaces': 'Workspace',
	'/my-tasks': 'MyTasks',
	'/calendar': 'Calendar',
	'/team': 'Team',
	'/profile': 'Profile',
	'/profile/edit': 'Profile',
	'/settings': 'Settings',
}
const pageFor = (pathname) => {
	if (EXACT_PAGES[pathname]) return EXACT_PAGES[pathname]
	if (pathname.startsWith('/workspaces/')) return 'Workspace'
	if (pathname === '/invite' || pathname.startsWith('/invite/')) return 'BoardInvite'
	if (pathname.startsWith('/public/')) return 'PublicBoard'
	return 'NotFound'
}
// Pages not yet moved to the new design still rely on the old top bar.

import { shouldBlockAccountGateRoute } from './lib/authRouteRules'
import { startPagePath } from './utils/preferences'
import { useAuthStore } from './store/useAuthStore'

export const App = () => {
	const location = useLocation()
	const navigate = useNavigate()
	const handledSocialRedirectRef = useRef(false)
	const { authUser, checkAuth, completeSocialRedirect, isCheckingAuth } = useAuthStore()
	// Remount pages on navigation, except Workspace: switching boards keeps it mounted
	// so the board, sidebar and socket are not torn down and loaded twice.
	const routesKey = location.pathname.startsWith('/workspaces') ? '/workspaces' : location.pathname

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
		PAGES[pageFor(window.location.pathname)]().catch(() => {})
	}, [checkAuth])

	useEffect(() => {
		if (handledSocialRedirectRef.current || !sessionStorage.getItem('pending-social-provider')) return
		handledSocialRedirectRef.current = true
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

	// An invite opened before signing in is remembered; once the account is ready,
	// bring the user back to the invite so they can confirm joining.
	useEffect(() => {
		if (!authUser || authUser.emailVerified === false || authUser.profileSetup === false) return
		let pendingInvite
		try {
			pendingInvite = localStorage.getItem('kanban-pending-invite')
		} catch {
			return
		}
		if (!pendingInvite || location.pathname === `/invite/${pendingInvite}`) return
		navigate(`/invite/${pendingInvite}`, { replace: true })
	}, [authUser, location.pathname, navigate])

	const needsVerification = authUser && authUser.emailVerified === false
	const needsSetup = authUser && authUser.profileSetup === false && authUser.emailVerified === true
	const requestedRedirect = new URLSearchParams(location.search).get('redirect')
	const accountGateBlocked = shouldBlockAccountGateRoute(location.pathname, authUser)
	const loginRedirect =
		// Same-origin paths only: "//host" and "/\host" both resolve to another site.
		requestedRedirect?.startsWith('/') && !requestedRedirect.startsWith('//') && !requestedRedirect.includes('\\')
			? requestedRedirect
			: startPagePath()

	if (isCheckingAuth) return <AppLoader />

	// Signed-out visitors go to sign-in and come back to the address they opened.
	const signInFirst = (
		<Navigate to={`/login?redirect=${encodeURIComponent(`${location.pathname}${location.search}`)}`} replace />
	)

	return (
		<>
			<Toaster position='bottom-right' richColors />
			<Suspense fallback={<AppLoader page />}>
			<Routes key={routesKey}>
				{needsVerification ? (
					<>
						<Route path='/verify-email' element={<VerifyEmail />} />
						<Route path='/login/verify-email' element={<VerifyEmail />} />
						<Route path='/login/resetpassword' element={<ResetPassword />} />
						<Route path='/public/:token' element={<PublicBoard />} />
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
						<Route path='/verify-email' element={<Navigate to='/setup-profile' replace />} />
						<Route path='/login/resetpassword' element={<ResetPassword />} />
						<Route path='/public/:token' element={<PublicBoard />} />
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
						<Route path='/invite' element={<BoardInvite />} />
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
							element={authUser ? <Workspace /> : signInFirst}
						/>
						<Route
							path='/my-tasks'
							element={
								authUser ? <MyTasks /> : signInFirst
							}
						/>
						<Route
							path='/calendar'
							element={
								authUser ? <CalendarPage /> : signInFirst
							}
						/>
						<Route
							path='/team'
							element={authUser ? <Team /> : signInFirst}
						/>
						<Route
							path='/workspaces/:boardId'
							element={authUser ? <Workspace /> : signInFirst}
						/>
						<Route
							path='/profile'
							element={
								authUser ? <Profile /> : signInFirst
							}
						/>
						<Route
							path='/profile/edit'
							element={
								authUser ? <Navigate to='/profile' replace /> : signInFirst
							}
						/>
						<Route
							path='/settings'
							element={
								authUser ? <Settings /> : signInFirst
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
