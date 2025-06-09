import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'

import Navbar from './components/Navbar'
import Home from './pages/Home'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import SetupProfile from './pages/SetupProfile'
import Signup from './pages/Signup'
import Workspace from './pages/Workspace'
import { useAuthStore } from './store/useAuthStore'

export const App = () => {
	const location = useLocation()
	const isWorkspace = location.pathname.startsWith('/workspaces')
	const { authUser, checkAuth, isCheckingAuth } = useAuthStore()

	useEffect(() => {
		checkAuth()
	}, [checkAuth])

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
						<Route
							path='/signup'
							element={!authUser ? <Signup /> : <Navigate to='/' replace />}
						/>
						<Route
							path='/login/resetpassword'
							element={
								!authUser ? <ResetPassword /> : <Navigate to='/' replace />
							}
						/>

						<Route
							path='/workspaces'
							element={authUser ? <Workspace /> : <Navigate to='/' replace />}
						/>
					</>
				)}
			</Routes>
		</>
	)
}

export default App
