import { useEffect } from 'react'
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
import EditProfile from './pages/EditProfile'
import Home from './pages/Home'
import Login from './pages/Login'
import NotFound from './pages/NotFound'
import Profile from './pages/Profile'
import ResetPassword from './pages/ResetPassword'
import Settings from './pages/Settings'
import SetupProfile from './pages/SetupProfile'
import Signup from './pages/Signup'
import VerifyEmail from './pages/VerifyEmail'
import Workspace from './pages/Workspace'
import { useAuthStore } from './store/useAuthStore'

export const App = () => {
	const location = useLocation()
	const navigate = useNavigate()
	const isWorkspace = location.pathname.startsWith('/workspaces')
	const { authUser, checkAuth, isCheckingAuth } = useAuthStore()

	useEffect(() => {
		checkAuth()
	}, [checkAuth])

	useEffect(() => {
		const pendingInvite = localStorage.getItem('kanban-pending-invite')
		if (!authUser || !pendingInvite) return
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
	}, [authUser, navigate])

	const needsSetup = authUser && authUser.profileSetup === false

	if (isCheckingAuth) {
		return (
			<div className='min-h-screen flex items-center justify-center text-lg font-semibold'>
				Loading...
			</div>
		)
	}

	return (
		<>
			<Toaster position='bottom-right' richColors />
			{!isWorkspace && <Navbar />}

			<Routes>
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
							element={!authUser ? <Login /> : <Navigate to='/' replace />}
						/>
						<Route path='/invite/:token' element={<BoardInvite />} />
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
