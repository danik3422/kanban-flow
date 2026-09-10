import { Activity, Clock3, X } from 'lucide-react'
import { useState } from 'react'
import Popover from './Popover'

const getActorName = (activity) =>
	activity.user?.name || activity.user?.email || 'Someone'

const ActivityFeed = ({ activities = [], isLoading = false }) => {
	const [isOpen, setIsOpen] = useState(false)

	return (
		<Popover isOpen={isOpen} onClose={() => setIsOpen(false)} className='activity-feed'>
			<button
				type='button'
				className='activity-feed-trigger'
				onClick={() => setIsOpen((value) => !value)}
				aria-label='Open activity feed'
				title='Activity feed'
				aria-expanded={isOpen}
			>
				<Activity size={18} />
			</button>
			{isOpen && (
				<div className='popover-shell activity-feed-popover'>
					<div className='popover-header activity-feed-header'>
						<div>
							<strong>Activity feed</strong>
							<small>{activities.length} recorded events</small>
						</div>
						<button type='button' className='icon-button' onClick={() => setIsOpen(false)} aria-label='Close activity feed' title='Close'>
							<X size={16} />
						</button>
					</div>
					{isLoading ? (
						<p className='activity-feed-empty'>Loading activity...</p>
					) : activities.length ? (
						<div className='activity-feed-list'>
							{activities.map((activity) => (
								<article className='activity-feed-item' key={activity._id}>
									<div className='activity-feed-item-icon'><Clock3 size={14} /></div>
									<div>
										<strong>{getActorName(activity)}</strong>
										<p>{activity.details || `${activity.action} ${activity.entityName}`}</p>
										<time dateTime={activity.createdAt}>
											{new Date(activity.createdAt).toLocaleString([], {
												dateStyle: 'medium',
												timeStyle: 'short',
											})}
										</time>
									</div>
								</article>
							))}
						</div>
					) : (
						<p className='activity-feed-empty'>No activity recorded yet.</p>
					)}
					<p className='activity-feed-retention'>This history is permanent.</p>
				</div>
			)}
		</Popover>
	)
}

export default ActivityFeed