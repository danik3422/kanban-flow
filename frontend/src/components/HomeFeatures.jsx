import {
  ArrowUpRight,
  ClipboardList,
	History,
	BellRing,
  UsersRound,
} from 'lucide-react'
import { features } from '../data/features'

const featureIcons = {
	tasks: ClipboardList,
	team: UsersRound,
	updates: BellRing,
	history: History,
}

const FeatureIcon = ({ name }) => {
	const Icon = featureIcons[name] || ClipboardList
	return <Icon size={22} strokeWidth={1.8} />
}

const HomeFeatures = () => {
	return (
		<section className='features-section' data-reveal>
			<div className='features-wrap'>
				<div className='features-heading reveal-item'>
					<div>
						<p className='eyebrow'>Built for the whole rhythm</p>
						<h2>Keep the work visible from first idea to final update.</h2>
						<p>One calm place for planning, teamwork, and the small signals that keep progress moving.</p>
					</div>
					<span className='features-heading-mark' aria-hidden='true'>04</span>
				</div>

				<div className='features-grid'>
					{features.map((feature, index) => (
						<article key={feature.title + index} className='feature-card reveal-item'>
							<div className='feature-icon'><FeatureIcon name={feature.icon} /></div>
							<div className='feature-content'><span>0{index + 1}</span><h3>{feature.title}</h3><p>{feature.description}</p></div>
							<div className='feature-card-footer'><span>{feature.detail}</span><ArrowUpRight className='feature-arrow' size={17} strokeWidth={2} /></div>
						</article>
					))}
				</div>
			</div>
		</section>
	)
}

export default HomeFeatures
