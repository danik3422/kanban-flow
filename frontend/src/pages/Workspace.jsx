import { Menu } from 'lucide-react'
import { useState } from 'react'
import WorkspaceSidebar from '../components/WorkspaceSidebar'

const Workspace = () => {
	const [isSidebarOpen, setIsSidebarOpen] = useState(false)

	return (
		<div className='flex h-screen'>
			<WorkspaceSidebar
				isOpen={isSidebarOpen}
				onClose={() => setIsSidebarOpen(false)}
			/>

			<main className='flex-1 bg-base-100 p-4 overflow-auto'>
				{/* Mobile toggle button */}
				<button
					onClick={() => setIsSidebarOpen(true)}
					className='md:hidden mb-4 text-base-content'
				>
					<Menu size={24} />
				</button>
				Main Content
			</main>
		</div>
	)
}

export default Workspace
