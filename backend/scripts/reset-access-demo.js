import mongoose from 'mongoose'

import { env } from '../config/env.js'
import Board from '../models/board.model.js'
import BoardActivity from '../models/boardActivity.model.js'
import BoardInvite from '../models/boardInvite.model.js'
import BoardMember from '../models/boardMember.model.js'
import Column from '../models/column.model.js'
import Notification from '../models/notification.model.js'
import Task from '../models/task.model.js'
import TaskActivity from '../models/taskActivity.model.js'
import User from '../models/user.model.js'

const ownerEmail = 'mr.siloacd@gmail.com'
const memberEmail = 'danylo.syloats@gmail.com'
const boardDefinitions = [
	{ name: 'Demo · Private Room', visibility: 'private' },
	{ name: 'Demo · Workspace Room', visibility: 'workspace' },
	{ name: 'Demo · Public Room', visibility: 'public' },
]
const columnDefinitions = [
	{ title: 'Backlog', pinned: true },
	{ title: 'To do' },
	{ title: 'In Progress' },
	{ title: 'Review' },
	{ title: 'Done' },
]
const taskDefinitions = [
	{ column: 'Backlog', title: 'Demo · Define the problem', priority: 'high', labels: ['research', 'planning'] },
	{ column: 'Backlog', title: 'Demo · Collect user feedback', priority: 'medium', labels: ['research'] },
	{ column: 'To do', title: 'Demo · Prepare implementation plan', priority: 'high', labels: ['planning'] },
	{ column: 'In Progress', title: 'Demo · Build the first workflow', priority: 'urgent', labels: ['engineering'] },
	{ column: 'In Progress', title: 'Demo · Review realtime behavior', priority: 'medium', labels: ['qa', 'realtime'] },
	{ column: 'Review', title: 'Demo · Check access permissions', priority: 'high', labels: ['security', 'qa'] },
	{ column: 'Done', title: 'Demo · Create the board structure', priority: 'none', labels: ['shipped'] },
]

const connect = async () => {
	if (!env.mongoUri) throw new Error('MONGO_URI is not configured')
	await mongoose.connect(env.mongoUri)
}

const removeAllRooms = async () => {
	const boards = await Board.find({}).select('_id').lean()
	const boardIds = boards.map((board) => board._id)
	const columns = await Column.find({ board: { $in: boardIds } }).select('_id').lean()
	const columnIds = columns.map((column) => column._id)
	const tasks = await Task.find({ column: { $in: columnIds } }).select('_id').lean()
	const taskIds = tasks.map((task) => task._id)

	await Promise.all([
		TaskActivity.deleteMany({ $or: [{ board: { $in: boardIds } }, { task: { $in: taskIds } }] }),
		Notification.deleteMany({ $or: [{ board: { $in: boardIds } }, { task: { $in: taskIds } }] }),
		BoardActivity.deleteMany({ board: { $in: boardIds } }),
		BoardInvite.deleteMany({ board: { $in: boardIds } }),
		BoardMember.deleteMany({ board: { $in: boardIds } }),
		Task.deleteMany({ column: { $in: columnIds } }),
		Column.deleteMany({ board: { $in: boardIds } }),
		Board.deleteMany({ _id: { $in: boardIds } }),
	])
	return boardIds.length
}

const createDemoRoom = async ({ owner, member, name, visibility }) => {
	const board = await Board.create({ name, visibility, createdBy: owner._id })
	await BoardMember.create([
		{ board: board._id, user: owner._id, role: 'admin' },
		{ board: board._id, user: member._id, role: 'member' },
	])

	const columns = await Column.insertMany(
		columnDefinitions.map((column, position) => ({ ...column, board: board._id, position })),
	)
	const columnByTitle = new Map(columns.map((column) => [column.title, column]))
	const tasks = await Task.insertMany(
		taskDefinitions.map((task, position) => ({
			column: columnByTitle.get(task.column)._id,
			title: task.title,
			description: `<p>Demo data for <strong>${name}</strong>. Use this card to verify permissions, activity history, ordering, and realtime updates.</p>`,
			position,
			priority: task.priority,
			labels: task.labels,
			assignees: [member._id],
			checklist: [
				{ text: 'Verify the expected behavior', completed: false },
				{ text: 'Record the result in Activity Feed', completed: false },
			],
		})),
	)

	await BoardActivity.create({
		board: board._id,
		user: owner._id,
		action: 'created',
		entityType: 'board',
		entityId: board._id,
		entityName: board.name,
		details: `created ${visibility} demo room`,
	})
	await BoardActivity.create({
		board: board._id,
		user: owner._id,
		action: 'added member',
		entityType: 'member',
		entityId: member._id,
		entityName: member.name || member.email,
		details: `added ${member.email} as a regular member`,
	})
	return { board, columns, tasks }
}

const run = async () => {
	await connect()
	const [owner, member] = await Promise.all([
		User.findOne({ email: ownerEmail }),
		User.findOne({ email: memberEmail }),
	])
	if (!owner || !member) {
		throw new Error(`Required users not found: ${[!owner && ownerEmail, !member && memberEmail].filter(Boolean).join(', ')}`)
	}

	const deletedRooms = await removeAllRooms()
	const rooms = []
	for (const definition of boardDefinitions) {
		rooms.push(await createDemoRoom({ owner, member, ...definition }))
	}

	console.log(JSON.stringify({
		deletedRooms,
		createdRooms: rooms.map(({ board, columns, tasks }) => ({
			id: board._id.toString(),
			name: board.name,
			visibility: board.visibility,
			columns: columns.length,
			tasks: tasks.length,
			owner: owner.email,
			member: member.email,
		})),
	}, null, 2))
}

run()
	.catch((error) => {
		console.error(error)
		process.exitCode = 1
	})
	.finally(async () => {
		await mongoose.disconnect()
	})
