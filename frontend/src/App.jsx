import { useEffect, useRef } from 'react'
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
import BoardInvite from './pages/BoardInvite'
import CalendarPage from './pages/Calendar'
import EditProfile from './pages/EditProfile'
import Home from './pages/Home'
import Login from './pages/Login'
import MyTasks from './pages/MyTasks'
import NotFound from './pages/NotFound'
import Profile from './pages/Profile'
import PublicBoard from './pages/PublicBoard'
import ResetPassword from './pages/ResetPassword'
import Settings from './pages/Settings'
import SetupProfile from './pages/SetupProfile'
import Signup from './pages/Signup'
import Team from './pages/Team'
import VerifyEmail from './pages/VerifyEmail'
import Workspace from './pages/Workspace'
import { useAuthStore } from './store/useAuthStore'

export const App = () => {
	const location = useLocation()
	const navigate = useNavigate()
	const handledInviteRef = useRef(null)
	const isWorkspace =
		location.pathname.startsWith('/workspaces') ||
		location.pathname === '/my-tasks' ||
		location.pathname === '/team'
	const { authUser, checkAuth, isCheckingAuth } = useAuthStore()
	const loadingLabel = isWorkspace ? 'Loading workspace' : 'Loading'

	useEffect(() => {
		checkAuth()
	}, [checkAuth])

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
				navigate(`/invite/${pendingInvite}?error=${encodeURIComponent(message)}`, {
					replace: true,
				})
			})
	}, [authUser, location.pathname, navigate])

	const needsSetup = authUser && authUser.profileSetup === false
	const requestedRedirect = new URLSearchParams(location.search).get('redirect')
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

			<Routes key={location.pathname}>
				{needsSetup ? (
					<>
						<Route path='/setup-profile' element={<SetupProfile />} />
						<Route
							path='*'
							element={<Navigate to='/setup-profile' replace />}
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
							element={!authUser ? <VerifyEmail /> : <Navigate to='/' replace />}
						/>

						<Route
							path='/workspaces'
							element={authUser ? <Workspace /> : <Navigate to='/' replace />}
						/>
						<Route
							path='/my-tasks'
							element={authUser ? <MyTasks /> : <Navigate to='/login' replace />}
						/>
						<Route
							path='/calendar'
							element={authUser ? <CalendarPage /> : <Navigate to='/login' replace />}
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
		</>
	)
}

export default App
