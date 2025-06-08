import {
	HelpCircle,
	Keyboard,
	LayoutDashboard,
	LogOut,
	Palette,
	Settings,
	User,
} from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore'

const AccountDropdown = () => {
	const { authUser, logout } = useAuthStore()
	const needsSetup = authUser?.profileSetup === false

	return (
		<div className='dropdown dropdown-end'>
			<label tabIndex={0} className='btn btn-ghost btn-circle avatar'>
				<div className='w-10 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2'>
					<img
						src={authUser.avatar || 'https://i.pravatar.cc/40?img=1'}
						alt='avatar'
					/>
				</div>
			</label>

			<div
				tabIndex={0}
				className='dropdown-content mt-3 z-50 w-72 bg-base-200 rounded-box shadow-lg p-4'
			>
				{/* User Info */}
				<div className='flex items-center gap-4 mb-4'>
					<div className='avatar'>
						<div className='w-12 rounded-full'>
							<img
								src={authUser.avatar || 'https://i.pravatar.cc/40?img=1'}
								alt='avatar'
							/>
						</div>
					</div>
					<div>
						<p className='font-bold'>{authUser.name || authUser.email}</p>
						<p className='text-sm text-gray-500'>{authUser.email}</p>
					</div>
				</div>

				{needsSetup ? (
					// Only Logout button if profile not set up
					<ul className='menu menu-sm bg-base-200 rounded-box'>
						<li>
							<button
								onClick={logout}
								className='flex items-center gap-2 text-error'
							>
								<LogOut className='w-4 h-4' />
								Log out
							</button>
						</li>
					</ul>
				) : (
					// Full menu once profileSetup is true
					<>
						{/* Account Section */}
						<p className='text-xs font-semibold text-gray-500 mb-1'>ACCOUNT</p>
						<ul className='menu menu-sm bg-base-200 rounded-box mb-2'>
							<li>
								<a className='flex items-center gap-2'>
									<User className='w-4 h-4' />
									Profile & Access
								</a>
							</li>
							<li>
								<a className='flex items-center gap-2'>
									<Settings className='w-4 h-4' />
									Account Settings
								</a>
							</li>
						</ul>

						{/* Trello Section */}
						<p className='text-xs font-semibold text-gray-500 mb-1'>TRELLO</p>
						<ul className='menu menu-sm bg-base-200 rounded-box mb-2'>
							<li>
								<a className='flex items-center gap-2'>
									<LayoutDashboard className='w-4 h-4' />
									Boards
								</a>
							</li>
							<li>
								<a className='flex items-center gap-2'>
									<Palette className='w-4 h-4' />
									Theme
								</a>
							</li>
						</ul>

						{/* More Section */}
						<p className='text-xs font-semibold text-gray-500 mb-1'>MORE</p>
						<ul className='menu menu-sm bg-base-200 rounded-box mb-2'>
							<li>
								<a className='flex items-center gap-2'>
									<HelpCircle className='w-4 h-4' />
									Help
								</a>
							</li>
							<li>
								<a className='flex items-center gap-2'>
									<Keyboard className='w-4 h-4' />
									Keyboard Shortcuts
								</a>
							</li>
						</ul>

						{/* Logout Button */}
						<div className='divider my-2' />
						<ul className='menu menu-sm bg-base-200 rounded-box'>
							<li>
								<button
									onClick={logout}
									className='flex items-center gap-2 text-error'
								>
									<LogOut className='w-4 h-4' />
									Log out
								</button>
							</li>
						</ul>
					</>
				)}
			</div>
		</div>
	)
}

export default AccountDropdown
