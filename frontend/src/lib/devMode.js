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

export const devBoardMembers = [
	{
		_id: 'dev-user',
		name: 'Danylo Syloats',
		email: 'demo@kanban.local',
		avatar: '/avatar.png',
		role: 'admin',
	},
	{
		_id: 'dev-member-1',
		name: 'Olena Kovalenko',
		email: 'olena@kanban.local',
		avatar: '/avatar.png',
		role: 'member',
	},
	{
		_id: 'dev-member-2',
		name: 'Mark Wilson',
		email: 'mark@kanban.local',
		avatar: '/avatar.png',
		role: 'admin',
	},
]

export const devBoardInvites = [
	{
		_id: 'dev-invite-1',
		email: 'sarah@kanban.local',
		createdAt: '2026-09-08T09:30:00.000Z',
		status: 'pending',
	},
	{
		_id: 'dev-invite-2',
		email: 'alex@kanban.local',
		createdAt: '2026-09-05T11:00:00.000Z',
		status: 'accepted',
	},
]

export const devColumns = [
	{
		_id: 'dev-backlog',
		title: 'Backlog',
		position: 0,
		tasks: [
			{
				_id: 'dev-task-1',
				title: 'Interview five users',
				description: 'Research',
				position: 0,
			},
			{
				_id: 'dev-task-2',
				title: 'Outline launch brief',
				description: 'Planning',
				position: 1,
			},
		],
	},
	{
		_id: 'dev-progress',
		title: 'In progress',
		position: 1,
		tasks: [
			{
				_id: 'dev-task-3',
				title: 'Polish onboarding flow',
				description: 'Design',
				position: 0,
			},
		],
	},
	{
		_id: 'dev-done',
		title: 'Done',
		position: 2,
		tasks: [
			{
				_id: 'dev-task-4',
				title: 'Set up analytics',
				description: 'Shipped',
				position: 0,
			},
		],
	},
]

// Dev mode has no server: list sorts are kept in this browser, per person and board.
const devSortKey = (boardId, userId = 'anonymous') => `kanban-column-sorts:${userId}:${boardId}`
export const saveDevColumnSort = (boardId, userId, columnId, sortType) => {
	let sorts = {}
	try {
		sorts = JSON.parse(localStorage.getItem(devSortKey(boardId, userId)) || '{}')
	} catch {
		// A broken saved value starts over.
	}
	localStorage.setItem(devSortKey(boardId, userId), JSON.stringify({ ...sorts, [columnId]: sortType }))
}
