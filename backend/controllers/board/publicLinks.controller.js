import crypto from 'node:crypto'

import { env } from '../../config/env.js'
import Board from '../../models/board.model.js'
import BoardMember from '../../models/boardMember.model.js'
import Column from '../../models/column.model.js'
import Task from '../../models/task.model.js'
import { canManageBoard } from '../../services/boardAccess.service.js'
import { finishedColumnIdsOf } from '../../services/finishedColumns.service.js'

// Read-only public links to a board, and the public board page itself.

export const getPublicBoardLink = async (req, res) => {
	try {
		const board = await Board.findById(req.board._id).select('+publicTokenHash')
		if (board.visibility !== 'public') return res.status(404).json({ message: 'Public link is unavailable' })
		if (!(await canManageBoard(board, req.user._id))) {
			return res.status(403).json({ message: 'Only the board owner or an admin can view the public link' })
		}
		const rawToken = crypto
			.createHmac('sha256', env.jwtSecret)
			.update(`${board._id.toString()}:${Number(board.publicTokenVersion || 0)}`)
			.digest('hex')
		const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
		if (!board.publicTokenHash || board.publicTokenHash !== tokenHash) {
			return res.status(404).json({ message: 'Public link has not been created' })
		}
		return res.status(200).json({ publicUrl: `${env.frontendUrl}/public/${rawToken}` })
	} catch (error) {
		console.error('Public board link lookup failed:', error)
		return res.status(500).json({ message: 'Could not load public view link' })
	}
}

export const createPublicBoardLink = async (req, res) => {
	try {
		const board = await Board.findById(req.board._id).select('+publicTokenHash')
		if (board.visibility !== 'public') {
			return res.status(400).json({ message: 'Only public rooms can have a public link' })
		}
		if (!(await canManageBoard(board, req.user._id))) {
			return res.status(403).json({ message: 'Only the board owner or an admin can create a public link' })
		}
		const publicTokenVersion = Number(board.publicTokenVersion || 0)
		const existingToken = crypto
			.createHmac('sha256', env.jwtSecret)
			.update(`${board._id.toString()}:${publicTokenVersion}`)
			.digest('hex')
		const existingTokenHash = crypto.createHash('sha256').update(existingToken).digest('hex')
		if (board.publicTokenHash !== existingTokenHash) {
			board.publicTokenVersion = publicTokenVersion + 1
			const rawToken = crypto
				.createHmac('sha256', env.jwtSecret)
				.update(`${board._id.toString()}:${board.publicTokenVersion}`)
				.digest('hex')
			board.publicTokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
			const updatedBoard = await Board.findOneAndUpdate(
				{ _id: board._id, visibility: 'public', publicTokenVersion },
				{
					$set: { publicTokenHash: board.publicTokenHash },
					$inc: { publicTokenVersion: 1 },
				},
				{ returnDocument: 'after' },
			)
			if (!updatedBoard) {
				return res.status(409).json({ message: 'Public link changed. Please try again.' })
			}
			return res.status(200).json({ publicUrl: `${env.frontendUrl}/public/${rawToken}` })
		}
		return res.status(200).json({ publicUrl: `${env.frontendUrl}/public/${existingToken}` })
	} catch (error) {
		console.error('Public board link creation failed:', error)
		return res.status(500).json({ message: 'Could not create public board link' })
	}
}

export const revokePublicBoardLink = async (req, res) => {
	try {
		const board = await Board.findById(req.board._id).select('+publicTokenHash')
		if (!(await canManageBoard(board, req.user._id))) {
			return res.status(403).json({ message: 'Only the board owner or an admin can revoke the public link' })
		}
		await Board.updateOne(
			{ _id: board._id },
			{
				$set: { publicTokenHash: '' },
				$inc: { publicTokenVersion: 1 },
			},
		)
		return res.status(204).send()
	} catch (error) {
		console.error('Public board link revoke failed:', error)
		return res.status(500).json({ message: 'Could not revoke public view link' })
	}
}

export const getPublicBoard = async (req, res) => {
	try {
		const tokenHash = crypto.createHash('sha256').update(req.params.token).digest('hex')
		const board = await Board.findOne({ visibility: 'public', publicTokenHash: tokenHash }).select('name visibility background labels createdAt updatedAt').lean()
		if (!board) return res.status(404).json({ message: 'Public room link is invalid or expired' })
		const [columns, isMember] = await Promise.all([
			Column.find({ board: board._id })
				.select('board title position sortBy pinned createdAt')
				.sort({ position: 1, createdAt: 1 })
				.lean(),
			req.user ? BoardMember.exists({ board: board._id, user: req.user._id }) : null,
		])
		const tasks = await Task.find({ column: { $in: columns.map((column) => column._id) } })
			.select('title description dueDate column position labels checklist priority updatedAt')
			.sort({ position: 1, createdAt: 1 })
			.lean()
		const [doneColumnId] = [...finishedColumnIdsOf(columns)]
		const updatedAt = tasks.reduce((latest, task) => (task.updatedAt > latest ? task.updatedAt : latest), board.updatedAt || board.createdAt)
		return res.status(200).json({
			board: { _id: board._id, name: board.name, background: board.background || null, labels: (board.labels || []).map(({ name, color }) => ({ name, color })), createdAt: board.createdAt, updatedAt },
			doneColumnId: doneColumnId || null,
			viewer: { isMember: Boolean(isMember) },
			columns: columns.map(({ board: _board, ...column }) => ({
				...column,
				tasks: tasks.filter((task) => task.column.toString() === column._id.toString()),
			})),
		})
	} catch (error) {
		console.error('Public board fetch failed:', error)
		return res.status(500).json({ message: 'Could not load public room' })
	}
}
