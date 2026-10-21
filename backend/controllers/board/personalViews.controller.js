import Board from '../../models/board.model.js'
import BoardMember from '../../models/boardMember.model.js'
import Column from '../../models/column.model.js'
import Task from '../../models/task.model.js'
import { finishedColumnIdsOf } from '../../services/finishedColumns.service.js'

// Views across all of a person's boards: my tasks, the calendar and the team.

const MY_TASKS_LIMIT = 1000

export const getMyTasks = async (req, res) => {
	try {
		// Repeated query keys arrive as arrays; only plain strings are meaningful filters.
		const readQuery = (value, fallback) => (typeof value === 'string' ? value : fallback)
		const search = readQuery(req.query.search ?? req.query.q, '').trim().toLowerCase().slice(0, 200)
		const priority = readQuery(req.query.priority, 'all')
		const board = readQuery(req.query.board, 'all')
		const [ownedBoardIds, memberships] = await Promise.all([
			Board.find({ createdBy: req.user._id }).distinct('_id'),
			BoardMember.find({ user: req.user._id }).select('board').lean(),
		])
		const accessibleBoardIds = [
			...new Set([
				...ownedBoardIds.map((boardId) => boardId.toString()),
				...memberships.map((membership) => membership.board.toString()),
			]),
		]
		// Filter in MongoDB instead of loading every assigned task into memory.
		const scopedBoardIds = board === 'all'
			? accessibleBoardIds
			: accessibleBoardIds.filter((boardId) => boardId === board)
		const columns = await Column.find({ board: { $in: scopedBoardIds } }).select('_id title board position').lean()
		const finishedColumnIds = finishedColumnIdsOf(columns)
		const query = {
			assignees: req.user._id,
			column: { $in: columns.map((column) => column._id) },
		}
		if (priority !== 'all') {
			query.priority = priority === 'none' ? { $in: ['none', null] } : priority
		}
		if (search) {
			const pattern = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
			const matchingBoardIds = new Set(
				(await Board.find({ _id: { $in: scopedBoardIds }, name: pattern }).distinct('_id'))
					.map((boardId) => boardId.toString()),
			)
			const matchingColumnIds = columns
				.filter((column) => pattern.test(column.title) || matchingBoardIds.has(column.board.toString()))
				.map((column) => column._id)
			query.$or = [
				{ title: pattern },
				{ description: pattern },
				{ labels: pattern },
				{ column: { $in: matchingColumnIds } },
			]
		}

		const tasks = await Task.find(query)
			.populate({
				path: 'column',
				select: 'title board',
				populate: { path: 'board', select: 'name' },
			})
			.populate('assignees', 'name email avatar')
			.sort({ dueDate: 1, updatedAt: -1 })
			.limit(MY_TASKS_LIMIT)
			.lean()

		// Same rule as the board list, so "open", "overdue" and "done" agree across pages.
		// doneColumnId lets the list finish a task by moving it there (null without a Done column).
		const doneColumnByBoard = new Map(columns
			.filter((column) => finishedColumnIds.has(column._id.toString()))
			.map((column) => [column.board.toString(), column._id.toString()]))
		return res.status(200).json(tasks.map((task) => {
			const boardId = (task.column?.board?._id || task.column?.board)?.toString()
			return {
				...task,
				isDone: finishedColumnIds.has((task.column?._id || task.column).toString()),
				doneColumnId: doneColumnByBoard.get(boardId) || null,
			}
		}))
	} catch (error) {
		console.error('My tasks fetch failed:', error)
		return res.status(500).json({ message: 'Could not load your tasks' })
	}
}

// Tasks due in a date range for the calendar: only mine, or everything on my boards.
// Dates are calendar days stored as UTC midnight, so the range is compared in UTC.
const CALENDAR_MAX_DAYS = 62

const CALENDAR_LIMIT = 2000

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

export const getCalendarTasks = async (req, res) => {
	try {
		const readQuery = (value) => (typeof value === 'string' ? value : '')
		const from = readQuery(req.query.from)
		const to = readQuery(req.query.to)
		const scope = readQuery(req.query.scope) === 'all' ? 'all' : 'mine'
		const board = readQuery(req.query.board) || 'all'
		const start = DATE_KEY.test(from) ? new Date(`${from}T00:00:00.000Z`) : null
		const end = DATE_KEY.test(to) ? new Date(`${to}T23:59:59.999Z`) : null
		if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
			return res.status(400).json({ message: 'A valid date range is required' })
		}
		if ((end - start) / 86400000 > CALENDAR_MAX_DAYS) {
			return res.status(400).json({ message: 'The date range is too long' })
		}

		const [ownedBoardIds, memberBoardIds] = await Promise.all([
			Board.find({ createdBy: req.user._id }).distinct('_id'),
			BoardMember.find({ user: req.user._id }).distinct('board'),
		])
		const accessibleBoardIds = [...new Set([...ownedBoardIds, ...memberBoardIds].map((id) => id.toString()))]
		const scopedBoardIds = board === 'all' ? accessibleBoardIds : accessibleBoardIds.filter((id) => id === board)
		const columns = await Column.find({ board: { $in: scopedBoardIds } }).select('_id title board position').lean()
		const finishedColumnIds = finishedColumnIdsOf(columns)
		const doneColumnByBoard = new Map(columns
			.filter((column) => finishedColumnIds.has(column._id.toString()))
			.map((column) => [column.board.toString(), column._id.toString()]))

		const query = {
			column: { $in: columns.map((column) => column._id) },
			dueDate: { $gte: start, $lte: end },
			...(scope === 'mine' && { assignees: req.user._id }),
		}
		const tasks = await Task.find(query)
			.select('title dueDate priority labels checklist assignees column position')
			.populate({ path: 'column', select: 'title board', populate: { path: 'board', select: 'name' } })
			.populate('assignees', 'name avatar')
			.sort({ dueDate: 1, position: 1 })
			.limit(CALENDAR_LIMIT)
			.lean()

		return res.status(200).json(tasks.map((task) => {
			const boardId = (task.column?.board?._id || task.column?.board)?.toString()
			return {
				...task,
				isDone: finishedColumnIds.has((task.column?._id || task.column).toString()),
				doneColumnId: doneColumnByBoard.get(boardId) || null,
				isMine: (task.assignees || []).some((person) => (person._id || person).toString() === req.user._id.toString()),
			}
		}))
	} catch (error) {
		console.error('Calendar fetch failed:', error)
		return res.status(500).json({ message: 'Could not load the calendar' })
	}
}

// Every accessible board with its members, for the Team page, in two queries.
export const getTeam = async (req, res) => {
	try {
		const memberBoardIds = await BoardMember.find({ user: req.user._id }).distinct('board')
		const boards = await Board.find({
			$or: [{ createdBy: req.user._id }, { _id: { $in: memberBoardIds } }],
		})
			.select('name createdBy visibility background')
			.lean()
		const members = await BoardMember.find({ board: { $in: boards.map((board) => board._id) } })
			.populate('user', 'name email avatar provider')
			.lean()
		const membersByBoard = new Map(boards.map((board) => [board._id.toString(), []]))
		for (const member of members) membersByBoard.get(member.board.toString())?.push(member)
		const userId = req.user._id.toString()

		// Workload per person and board: open and overdue tasks, finished work (last column) left out.
		const columns = await Column.find({ board: { $in: boards.map((board) => board._id) } }).select('_id board position').lean()
		const finishedColumnIds = finishedColumnIdsOf(columns)
		const boardOfColumn = new Map(columns.map((column) => [column._id.toString(), column.board.toString()]))
		const startOfToday = new Date()
		startOfToday.setHours(0, 0, 0, 0)
		const openColumnIds = columns.filter((column) => !finishedColumnIds.has(column._id.toString())).map((column) => column._id)
		const workloadGroups = await Task.aggregate([
			{ $match: { column: { $in: openColumnIds }, 'assignees.0': { $exists: true } } },
			{ $unwind: '$assignees' },
			{
				$group: {
					_id: { column: '$column', user: '$assignees' },
					open: { $sum: 1 },
					overdue: { $sum: { $cond: [{ $and: [{ $ne: ['$dueDate', null] }, { $lt: ['$dueDate', startOfToday] }] }, 1, 0] } },
				},
			},
		])
		const workload = new Map()
		for (const group of workloadGroups) {
			const key = `${boardOfColumn.get(group._id.column.toString())}:${group._id.user.toString()}`
			const entry = workload.get(key) || { open: 0, overdue: 0 }
			entry.open += group.open
			entry.overdue += group.overdue
			workload.set(key, entry)
		}
		return res.status(200).json(boards.map((board) => {
			const boardMembers = membersByBoard.get(board._id.toString()) || []
			const isOwner = board.createdBy.toString() === userId
			// Same access fields as /boards so the sidebar can group rooms.
			const ownMembership = boardMembers.find((member) => member.user?._id?.toString() === userId)
			return {
				board: {
					...board,
					access: isOwner ? 'owned' : 'invited',
					role: isOwner ? 'owner' : ownMembership?.role || 'member',
				},
				members: boardMembers.map((member) => {
					const load = workload.get(`${board._id.toString()}:${member.user?._id?.toString()}`) || { open: 0, overdue: 0 }
					return { ...member, openTasks: load.open, overdueTasks: load.overdue }
				}),
			}
		}))
	} catch (error) {
		console.error('Team fetch failed:', error)
		return res.status(500).json({ message: 'Could not load team' })
	}
}
