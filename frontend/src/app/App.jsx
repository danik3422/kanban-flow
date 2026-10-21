import { lazy, Suspense, useEffect, useRef } from 'react'
import {
	Navigate,
	Route,
	Routes,
	useLocation,
	useNavigate,
	useNavigationType,
} from 'react-router-dom'
import Toaster from '../ui/Toaster'

import AppLoader from './AppLoader'
import OfflineBanner from './OfflineBanner'
import { axiosInstance } from '../lib/axios'
// Page chunks, keyed so the one for the opened address can start downloading
// while the session is still being checked instead of after it.
const PAGES = {
	About: () => import('../pages/About'),
	SelfHosting: () => import('../pages/SelfHosting'),
	BoardInvite: () => import('../pages/BoardInvite'),
	Calendar: () => import('../pages/Calendar'),
	Home: () => import('../pages/Home'),
	Login: () => import('../pages/Login'),
	MyTasks: () => import('../pages/MyTasks'),
	NotFound: () => import('../pages/NotFound'),
	Profile: () => import('../pages/Profile'),
	PublicBoard: () => import('../pages/PublicBoard'),
	ResetPassword: () => import('../pages/ResetPassword'),
	Settings: () => import('../pages/Settings'),
	SetupProfile: () => import('../pages/SetupProfile'),
	Signup: () => import('../pages/Signup'),
	Team: () => import('../pages/Team'),
	VerifyEmail: () => import('../pages/VerifyEmail'),
	Workspace: () => import('../pages/Workspace'),
}
const About = lazy(PAGES.About)
const SelfHosting = lazy(PAGES.SelfHosting)
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
	'/about': 'About',
	'/self-hosting': 'SelfHosting',
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

import { shouldBlockAccountGateRoute } from './authRouteRules'
import { applyPageMeta, pageMetaFor } from '../lib/seo'
import { useI18n } from '../i18n'
import { startPagePath } from '../lib/preferences'
import { useAuthStore } from '../store/useAuthStore'
import { useServerConfig } from '../lib/serverConfig'

export const App = () => {
	const location = useLocation()
	const navigationType = useNavigationType()
	const navigate = useNavigate()
	const handledSocialRedirectRef = useRef(false)
	const { language } = useI18n()
	const { authUser, checkAuth, completeSocialRedirect, isCheckingAuth } = useAuthStore()
	const selfHosted = useServerConfig((state) => state.selfHosted)
	// Remount pages on navigation, except Workspace: switching boards keeps it mounted
	// so the board, sidebar and socket are not torn down and loaded twice.
	const routesKey = location.pathname.startsWith('/workspaces') ? '/workspaces' : location.pathname

	// A link to another page opens it at the top; Back/Forward keep the browser's own
	// scroll restoration, and #anchors scroll to their section.
	useEffect(() => {
		if (navigationType === 'POP' || location.hash) return
		window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
	}, [location.pathname, location.hash, navigationType])

	useEffect(() => {
		applyPageMeta(pageMetaFor(location.pathname, language))
	}, [location.pathname, language])

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
			<Toaster />
			<OfflineBanner />
			<Suspense fallback={<AppLoader page />}>
			<Routes key={routesKey}>
				{needsVerification ? (
					<>
						<Route path='/verify-email' element={<VerifyEmail />} />
						<Route path='/login/verify-email' element={<VerifyEmail />} />
						<Route path='/login/resetpassword' element={<ResetPassword />} />
						<Route path='/public/:token' element={<PublicBoard />} />
						<Route path='/about' element={<About />} />
						<Route path='/self-hosting' element={<SelfHosting />} />
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
						<Route path='/about' element={<About />} />
						<Route path='/self-hosting' element={<SelfHosting />} />
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
						{/* A self-hosted server is the app itself: no product page in front of it. */}
						<Route path='/' element={selfHosted ? <Navigate to={authUser ? startPagePath() : '/login'} replace /> : <Home />} />
						<Route
							path='/login'
							element={
								!authUser ? <Login /> : <Navigate to={loginRedirect} replace />
							}
						/>
						<Route path='/invite' element={<BoardInvite />} />
						<Route path='/invite/:token' element={<BoardInvite />} />
						<Route path='/public/:token' element={<PublicBoard />} />
						<Route path='/about' element={<About />} />
						<Route path='/self-hosting' element={<SelfHosting />} />
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
