import { features } from '../data/features'

const FeaturesSection = () => {
	return (
		<section className='py-24 bg-base-100'>
			<div className='max-w-6xl mx-auto px-4'>
				<h2 className='text-4xl md:text-5xl font-bold text-center mb-16'>
					Why Choose Our Trello Clone?
				</h2>

				<div className='grid gap-8 sm:grid-cols-2 lg:grid-cols-3'>
					{features.map((feature, index) => (
						<div
							key={feature.title + index}
							className='group bg-base-200 p-8 rounded-3xl text-center shadow-lg transition-all duration-300 hover:-translate-y-2 hover:shadow-xl'
						>
							<div className='text-5xl mb-6 transition-transform duration-300 group-hover:scale-125'>
								{feature.icon}
							</div>
							<h3 className='text-2xl font-semibold mb-3'>{feature.title}</h3>
							<p className='text-base text-base-content/80'>
								{feature.description}
							</p>
						</div>
					))}
				</div>
			</div>
		</section>
	)
}

export default FeaturesSection
