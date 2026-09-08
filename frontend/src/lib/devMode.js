export const isDevAuthBypass =
	import.meta.env.DEV && import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'

export const devUser = {
	_id: 'dev-user',
	email: 'demo@kanban.local',
	name: 'Danylo',
	avatar: '/avatar.png',
	provider: 'local',
	profileSetup: true,
}

export const devBoard = {
	_id: 'dev-board',
	name: 'Product launch',
	createdBy: 'dev-user',
}

export const devColumns = [
	{
		_id: 'dev-backlog',
		title: 'Backlog',
		position: 0,
		tasks: [
			{ _id: 'dev-task-1', title: 'Interview five users', description: 'Research', position: 0 },
			{ _id: 'dev-task-2', title: 'Outline launch brief', description: 'Planning', position: 1 },
		],
	},
	{
		_id: 'dev-progress',
		title: 'In progress',
		position: 1,
		tasks: [
			{ _id: 'dev-task-3', title: 'Polish onboarding flow', description: 'Design', position: 0 },
		],
	},
	{
		_id: 'dev-done',
		title: 'Done',
		position: 2,
		tasks: [
			{ _id: 'dev-task-4', title: 'Set up analytics', description: 'Shipped', position: 0 },
		],
	},
]
