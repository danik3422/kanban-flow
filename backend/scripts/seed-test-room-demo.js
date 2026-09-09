import mongoose from 'mongoose'

import { env } from '../config/env.js'
import Board from '../models/board.model.js'
import BoardInvite from '../models/boardInvite.model.js'
import BoardMember from '../models/boardMember.model.js'
import Column from '../models/column.model.js'
import Notification from '../models/notification.model.js'
import Task from '../models/task.model.js'
import TaskActivity from '../models/taskActivity.model.js'
import User from '../models/user.model.js'

const ownerEmail = 'mr.siloacd@gmail.com'
const boardName = 'Test Room'
const demoPrefix = 'Demo ·'
const columnNames = ['Backlog', 'To do', 'In Progress', 'Review', 'Done']

const daysFromNow = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000)

const taskTemplates = [
	{
		column: 'Backlog',
		title: 'Demo · Research customer interviews',
		description: '<p>Collect insights from five users and summarize the main workflow friction.</p><p><strong>Output:</strong> a short research brief for the team.</p>',
		labels: ['research', 'planning'],
		dueDate: daysFromNow(7),
		checklist: [
			{ text: 'Prepare interview questions', completed: true },
			{ text: 'Schedule five interviews', completed: false },
			{ text: 'Share findings', completed: false },
		],
	},
	{
		column: 'To do',
		title: 'Demo · Write launch brief',
		description: '<p>Prepare the launch brief with audience, scope, milestones, and risks.</p>',
		labels: ['content'],
		dueDate: daysFromNow(3),
		checklist: [
			{ text: 'Define audience', completed: false },
			{ text: 'Add milestones', completed: false },
		],
	},
	{
		column: 'In Progress',
		title: 'Demo · Polish onboarding flow',
		description: '<p>Improve the first-run experience and make the next action obvious.</p><ul><li>Keep the first screen focused.</li><li>Show a useful example board.</li></ul>',
		labels: ['design', 'priority'],
		dueDate: daysFromNow(1),
		checklist: [
			{ text: 'Review current flow', completed: true },
			{ text: 'Implement empty state', completed: true },
			{ text: 'Test on mobile', completed: false },
		],
		trackedSeconds: 9360,
	},
	{
		column: 'Review',
		title: 'Demo · Review notification copy',
		description: '<p>Review notification wording and check that each action has a clear next step.</p>',
		labels: ['review'],
		dueDate: daysFromNow(2),
		checklist: [{ text: 'Check unread state', completed: false }],
	},
	{
		column: 'Done',
		title: 'Demo · Set up analytics',
		description: '<p>Analytics events are connected and ready for product review.</p>',
		labels: ['shipped'],
		dueDate: daysFromNow(-2),
		checklist: [
			{ text: 'Define events', completed: true },
			{ text: 'Verify dashboard', completed: true },
		],
		trackedSeconds: 4500,
	},
	{
		column: 'Backlog',
		title: 'Demo · Map the billing journey',
		description: '<p>Document the current billing journey and highlight confusing steps.</p>',
		labels: ['research', 'billing'],
		dueDate: daysFromNow(12),
		checklist: [
			{ text: 'Collect support tickets', completed: false },
			{ text: 'Interview two customers', completed: false },
		],
	},
	{
		column: 'Backlog',
		title: 'Demo · Explore integrations',
		description: '<p>Compare the first three integrations to build next quarter.</p>',
		labels: ['planning', 'api'],
		dueDate: daysFromNow(18),
		checklist: [],
	},
	{
		column: 'To do',
		title: 'Demo · Prepare release checklist',
		description: '<p>Turn the release process into a repeatable checklist for the whole team.</p>',
		labels: ['planning', 'release'],
		dueDate: daysFromNow(5),
		checklist: [
			{ text: 'Review staging environment', completed: true },
			{ text: 'Confirm rollback plan', completed: false },
			{ text: 'Assign release owner', completed: false },
		],
	},
	{
		column: 'To do',
		title: 'Demo · Add empty state illustration',
		description: '<p>Create a friendly empty state that gives new users a clear next step.</p>',
		labels: ['design'],
		dueDate: daysFromNow(9),
		checklist: [{ text: 'Review copy options', completed: false }],
	},
	{
		column: 'In Progress',
		title: 'Demo · Build activity timeline',
		description: '<p>Show task history in a compact timeline with comments and time entries.</p>',
		labels: ['engineering', 'priority'],
		dueDate: daysFromNow(4),
		checklist: [
			{ text: 'Define event types', completed: true },
			{ text: 'Add timeline layout', completed: true },
			{ text: 'Test realtime updates', completed: false },
		],
		trackedSeconds: 12600,
	},
	{
		column: 'In Progress',
		title: 'Demo · Improve mobile navigation',
		description: '<p>Make the workspace comfortable to use on narrow screens.</p>',
		labels: ['mobile', 'design'],
		dueDate: daysFromNow(6),
		checklist: [
			{ text: 'Audit small screens', completed: true },
			{ text: 'Test touch targets', completed: false },
		],
		trackedSeconds: 5400,
	},
	{
		column: 'Review',
		title: 'Demo · Check keyboard navigation',
		description: '<p>Verify that primary board actions work without a mouse.</p>',
		labels: ['accessibility', 'qa'],
		dueDate: daysFromNow(1),
		checklist: [
			{ text: 'Test focus order', completed: true },
			{ text: 'Test modal escape', completed: false },
		],
	},
	{
		column: 'Review',
		title: 'Demo · Validate email templates',
		description: '<p>Check verification and password reset emails on desktop and mobile.</p>',
		labels: ['qa', 'email'],
		dueDate: daysFromNow(3),
		checklist: [{ text: 'Send test messages', completed: false }],
	},
	{
		column: 'Done',
		title: 'Demo · Create first project board',
		description: '<p>The initial board structure is ready for the team to use.</p>',
		labels: ['shipped'],
		dueDate: daysFromNow(-6),
		checklist: [
			{ text: 'Add columns', completed: true },
			{ text: 'Invite teammates', completed: true },
		],
	},
	{
		column: 'Done',
		title: 'Demo · Connect realtime updates',
		description: '<p>Board changes now appear for everyone without a manual refresh.</p>',
		labels: ['engineering', 'shipped'],
		dueDate: daysFromNow(-10),
		checklist: [
			{ text: 'Join board room', completed: true },
			{ text: 'Broadcast updates', completed: true },
		],
		trackedSeconds: 7200,
	},
]

const run = async () => {
	if (!env.mongoUri) throw new Error('MONGO_URI is required to seed Test Room')
	await mongoose.connect(env.mongoUri)

	const owner = await User.findOne({ email: ownerEmail.toLowerCase() })
	if (!owner) throw new Error(`User not found: ${ownerEmail}`)

	const ownedBoard = await Board.findOne({ name: boardName, createdBy: owner._id })
	const memberBoard = ownedBoard
		? null
		: await BoardMember.findOne({ user: owner._id }).distinct('board')
	const board = ownedBoard || (memberBoard?.length
		? await Board.findOne({ _id: { $in: memberBoard }, name: boardName })
		: null)
	if (!board) throw new Error(`Board not found: ${boardName}`)

	await BoardMember.updateOne(
		{ board: board._id, user: owner._id },
		{ $setOnInsert: { role: 'admin' } },
		{ upsert: true },
	)

	const existingColumns = await Column.find({ board: board._id }).select('_id').lean()
	const existingColumnIds = existingColumns.map((column) => column._id)
	const resetTasks = await Task.deleteMany({ column: { $in: existingColumnIds } })
	const resetColumns = await Column.deleteMany({ board: board._id })
	const resetActivities = await TaskActivity.deleteMany({ board: board._id })
	const resetNotifications = await Notification.deleteMany({ board: board._id })
	const resetInvites = await BoardInvite.deleteMany({ board: board._id })

	const columns = new Map()
	for (let index = 0; index < columnNames.length; index += 1) {
		const title = columnNames[index]
		const column = await Column.create({ board: board._id, title, position: index })
		columns.set(title, column)
	}

	const memberIds = (await BoardMember.find({ board: board._id }).select('user').lean()).map((member) => member.user)
	const assigneeIds = memberIds.length ? memberIds : [owner._id]
	let createdTasks = 0
	let createdActivities = 0

	for (const template of taskTemplates) {
		const column = columns.get(template.column)
		const existing = await Task.findOne({ column: column._id, title: template.title })
		if (existing) continue

		const task = await Task.create({
			title: template.title,
			description: template.description,
			dueDate: template.dueDate,
			column: column._id,
			position: await Task.countDocuments({ column: column._id }),
			assignees: [assigneeIds[createdTasks % assigneeIds.length]],
			labels: template.labels,
			checklist: template.checklist,
			trackedSeconds: template.trackedSeconds || 0,
		})
		const activity = await TaskActivity.create({
			task: task._id,
			board: board._id,
			user: owner._id,
			type: 'created',
			message: `added this card to ${column.title}`,
		})
		createdTasks += 1
		createdActivities += 1

		if (template.trackedSeconds) {
			await TaskActivity.create({
				task: task._id,
				board: board._id,
				user: owner._id,
				type: 'time_logged',
				message: 'logged time on this card',
				durationMinutes: Math.round(template.trackedSeconds / 60),
			})
			createdActivities += 1
		}

		if (template.column === 'In Progress') {
			await TaskActivity.create({
				task: task._id,
				board: board._id,
				user: owner._id,
				type: 'comment',
				message: 'Demo comment: this task is ready for a team review.',
			})
			createdActivities += 1
		}
		void activity
	}

	console.log(JSON.stringify({
		board: board.name,
		reset: {
			tasks: resetTasks.deletedCount,
			columns: resetColumns.deletedCount,
			activities: resetActivities.deletedCount,
			notifications: resetNotifications.deletedCount,
			invites: resetInvites.deletedCount,
		},
		columns: columnNames.length,
		createdTasks,
		createdActivities,
	}, null, 2))
	await mongoose.disconnect()
}

run().catch(async (error) => {
	console.error(error.message)
	await mongoose.disconnect()
	process.exitCode = 1
})
