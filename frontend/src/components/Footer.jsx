const Footer = () => {
	const year = new Date().getFullYear()

	return (
		<footer className='py-6 text-center text-sm text-base-content/60 mt-auto'>
			© {year} Trello Clone — Built with{' '}
			<span className='font-medium'>React</span>,{' '}
			<span className='font-medium'>Firebase</span>, and{' '}
			<span className='font-medium'>DaisyUI</span>
		</footer>
	)
}

export default Footer
