import { ClipboardList, LayoutDashboard, UsersRound } from 'lucide-react'
import { features } from '../data/features'

const featureIcons = {
	tasks: ClipboardList,
	team: UsersRound,
	boards: LayoutDashboard,
}

const FeatureIcon = ({ name }) => {
	const Icon = featureIcons[name] || ClipboardList
	return <Icon size={22} strokeWidth={1.8} />
}

const HomeFeatures = () => {
	return (
		<section className='features-section' data-reveal>
			<div className='features-wrap'>
				<div className='features-heading reveal-item'><p className='eyebrow'>Designed for momentum</p><h2>Everything your team needs to move with clarity.</h2><p>Less noise in the process. More confidence in what happens next.</p></div>

				<div className='features-list'>
					{features.map((feature, index) => (
						<div key={feature.title + index} className='feature-item reveal-item'>
							<div className='feature-icon'><FeatureIcon name={feature.icon} /></div>
							<div className='feature-content'><span>0{index + 1}</span><h3>{feature.title}</h3><p>{feature.description}</p></div>
							<div className='feature-arrow' aria-hidden='true'>↗</div>
						</div>
					))}
				</div>
			</div>
		</section>
	)
}

export default HomeFeatures
