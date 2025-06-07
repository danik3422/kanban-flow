import { Link } from 'react-router-dom'

const HeroSection = () => {
	return (
		<section className='flex flex-col items-center justify-center text-center py-40 px-6 bg-base-200'>
			<img
				src='https://cdn.worldvectorlogo.com/logos/trello.svg'
				alt='Trello Logo'
				className='h-20 mb-8'
			/>
			<h1 className='text-5xl md:text-6xl font-bold mb-6'>Trello Clone</h1>
			<p className='text-xl md:text-2xl max-w-3xl mb-10 text-base-content/80'>
				A modern Kanban board to organize your tasks, collaborate with your
				team, and boost productivity.
			</p>
			<div className='flex gap-4 flex-wrap justify-center'>
				<Link to='/signup' className='btn btn-primary btn-lg'>
					Get Started
				</Link>
				<Link to='/login' className='btn btn-outline btn-lg'>
					Log In
				</Link>
			</div>
		</section>
	)
}

export default HeroSection
