import { emitBoardEvent } from '../../lib/realtime.js'
import BoardRule from '../../models/boardRule.model.js'
import Column from '../../models/column.model.js'
import Task from '../../models/task.model.js'
import { getBoardWithRole } from '../../services/boardAccess.service.js'

// A board's label set. Renaming or deleting a label updates every card that uses it.

const MAX_LABELS_PER_BOARD = 60
const MANAGER_ROLES = new Set(['owner', 'admin'])

export const createBoardLabel = async (req, res) => {
	try {
		const access = await getBoardWithRole(req.params.id, req.user._id)
		if (!access) return res.status(404).json({ message: 'Board not found' })
		const { board } = access
		const name = req.body.name.trim()
		if (board.labels.some((label) => label.name.toLowerCase() === name.toLowerCase())) {
			return res.status(400).json({ message: 'A label with this name already exists' })
		}
		if (board.labels.length >= MAX_LABELS_PER_BOARD) return res.status(400).json({ message: 'A board can have up to 60 labels' })
		board.labels.push({ name, color: req.body.color })
		await board.save()
		emitBoardEvent(board._id.toString(), 'board:updated', { _id: board._id, labels: board.labels })
		return res.status(201).json(board.labels)
	} catch (error) {
		console.error('Label creation failed:', error)
		return res.status(500).json({ message: 'Could not create the label' })
	}
}

/** Renaming a label renames it on every card of the board. */
export const updateBoardLabel = async (req, res) => {
	try {
		const access = await getBoardWithRole(req.params.id, req.user._id)
		if (!access) return res.status(404).json({ message: 'Board not found' })
		// Renaming or deleting a label rewrites every card, so it is for board admins.
		if (!MANAGER_ROLES.has(access.role)) return res.status(403).json({ message: 'Only board admins can change labels' })
		const { board } = access
		const label = board.labels.id(req.params.labelId)
		if (!label) return res.status(404).json({ message: 'Label not found' })
		const previousName = label.name
		if (req.body.name !== undefined) {
			const name = req.body.name.trim()
			if (board.labels.some((item) => item._id.toString() !== label._id.toString() && item.name.toLowerCase() === name.toLowerCase())) {
				return res.status(400).json({ message: 'A label with this name already exists' })
			}
			label.name = name
		}
		if (req.body.color !== undefined) label.color = req.body.color
		await board.save()
		if (label.name !== previousName) {
			const columnIds = await Column.find({ board: board._id }).distinct('_id')
			await Task.updateMany({ column: { $in: columnIds }, labels: previousName }, { $set: { 'labels.$': label.name } })
			// Automation rules that name the label follow the new name.
			await BoardRule.updateMany({ board: board._id, 'actions.label': previousName }, { $set: { 'actions.$[action].label': label.name } }, { arrayFilters: [{ 'action.label': previousName }] })
			await BoardRule.updateMany({ board: board._id, 'actions.labels': previousName }, { $set: { 'actions.$[].labels.$[name]': label.name } }, { arrayFilters: [{ name: previousName }] })
			emitBoardEvent(board._id.toString(), 'board:rules-changed', {})
			emitBoardEvent(board._id.toString(), 'board:content-changed', {})
		}
		emitBoardEvent(board._id.toString(), 'board:updated', { _id: board._id, labels: board.labels })
		return res.status(200).json(board.labels)
	} catch (error) {
		console.error('Label update failed:', error)
		return res.status(500).json({ message: 'Could not change the label' })
	}
}

export const deleteBoardLabel = async (req, res) => {
	try {
		const access = await getBoardWithRole(req.params.id, req.user._id)
		if (!access) return res.status(404).json({ message: 'Board not found' })
		// Renaming or deleting a label rewrites every card, so it is for board admins.
		if (!MANAGER_ROLES.has(access.role)) return res.status(403).json({ message: 'Only board admins can change labels' })
		const { board } = access
		const label = board.labels.id(req.params.labelId)
		if (!label) return res.status(404).json({ message: 'Label not found' })
		const name = label.name
		label.deleteOne()
		await board.save()
		const columnIds = await Column.find({ board: board._id }).distinct('_id')
		await Task.updateMany({ column: { $in: columnIds } }, { $pull: { labels: name } })
		emitBoardEvent(board._id.toString(), 'board:updated', { _id: board._id, labels: board.labels })
		emitBoardEvent(board._id.toString(), 'board:content-changed', {})
		return res.status(200).json(board.labels)
	} catch (error) {
		console.error('Label deletion failed:', error)
		return res.status(500).json({ message: 'Could not delete the label' })
	}
}
