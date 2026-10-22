import mongoose from 'mongoose'

import { emitBoardEvent } from '../../lib/realtime.js'
import BoardRule from '../../models/boardRule.model.js'
import Column from '../../models/column.model.js'
import { getBoardWithRole, validateBoardAssignees } from '../../services/boardAccess.service.js'
import { MAX_RULES_PER_BOARD, runRuleNow } from '../../services/automation.service.js'
import { nextRunAfter } from '../../services/schedule.service.js'

// A board's automation rules. Everyone on the board sees them and may add their own;
// a rule can be changed by whoever made it and by the board's owner and admins.

const MANAGER_ROLES = new Set(['owner', 'admin'])

const fail = (status, message) => Object.assign(new Error(message), { statusCode: status })

const respondError = (res, error, fallback) => {
	if (error.statusCode) return res.status(error.statusCode).json({ message: error.message })
	console.error(`${fallback}:`, error)
	return res.status(500).json({ message: fallback })
}

const boardAccess = async (req) => {
	const access = await getBoardWithRole(req.params.id, req.user._id)
	if (!access) throw fail(404, 'Board not found')
	return access
}

const ruleOf = async (req, access) => {
	if (!mongoose.Types.ObjectId.isValid(req.params.ruleId)) throw fail(404, 'Rule not found')
	const rule = await BoardRule.findOne({ _id: req.params.ruleId, board: access.board._id })
	if (!rule) throw fail(404, 'Rule not found')
	if (!rule.createdBy.equals(req.user._id) && !MANAGER_ROLES.has(access.role)) throw fail(403, 'Only the rule’s author or a board admin can change it')
	return rule
}

/** Lists, people and labels a rule names must belong to this board. */
const checkReferences = async (board, body) => {
	const columnIds = [body.trigger.column, ...body.actions.flatMap((action) => [action.column, action.from])].filter(Boolean)
	if (columnIds.length) {
		const found = await Column.countDocuments({ board: board._id, _id: { $in: [...new Set(columnIds)] } })
		if (found !== new Set(columnIds).size) throw fail(400, 'Choose a list on this board.')
	}
	const people = body.actions.flatMap((action) => action.users || [])
	if (people.length && !(await validateBoardAssignees(board, people))) throw fail(400, 'All assignees must be active board members')
	const labels = body.actions.flatMap((action) => [action.label, ...(action.labels || [])]).filter(Boolean)
	if (labels.some((name) => !board.labels.some((label) => label.name === name))) throw fail(400, 'Choose a label from this board')
}

const scheduleFor = (body, timezone) => (body.trigger.type === 'schedule'
	? { ...body.trigger.schedule, timezone: timezone || 'UTC' }
	: undefined)

const shown = (rule, req, role) => {
	const plain = rule.toObject ? rule.toObject() : rule
	const authorId = plain.createdBy?._id || plain.createdBy
	return { ...plain, canEdit: String(authorId) === String(req.user._id) || MANAGER_ROLES.has(role) }
}

const announce = (boardId) => emitBoardEvent(boardId.toString(), 'board:rules-changed', {})

/** GET /boards/:id/rules */
export const listRules = async (req, res) => {
	try {
		const access = await boardAccess(req)
		const rules = await BoardRule.find({ board: access.board._id }).sort({ createdAt: 1 }).populate('createdBy', 'name email avatar').lean()
		return res.status(200).json(rules.map((rule) => shown(rule, req, access.role)))
	} catch (error) {
		return respondError(res, error, 'Could not load the rules')
	}
}

/** POST /boards/:id/rules */
export const createRule = async (req, res) => {
	try {
		const access = await boardAccess(req)
		if (await BoardRule.countDocuments({ board: access.board._id }) >= MAX_RULES_PER_BOARD) throw fail(400, `A board can have up to ${MAX_RULES_PER_BOARD} rules`)
		await checkReferences(access.board, req.body)
		const schedule = scheduleFor(req.body, req.user.timezone)
		const rule = await BoardRule.create({
			board: access.board._id,
			createdBy: req.user._id,
			name: req.body.name,
			enabled: req.body.enabled,
			trigger: { ...req.body.trigger, ...(schedule && { schedule, column: null }) },
			actions: req.body.actions,
			nextRunAt: schedule && req.body.enabled ? nextRunAfter(schedule) : null,
		})
		await rule.populate('createdBy', 'name email avatar')
		announce(access.board._id)
		return res.status(201).json(shown(rule, req, access.role))
	} catch (error) {
		return respondError(res, error, 'Could not save the rule')
	}
}

/** PUT /boards/:id/rules/:ruleId — the whole rule again, as the editor has it. */
export const updateRule = async (req, res) => {
	try {
		const access = await boardAccess(req)
		const rule = await ruleOf(req, access)
		await checkReferences(access.board, req.body)
		// The time zone stays the author's, whoever edits the rule.
		const schedule = scheduleFor(req.body, rule.trigger.schedule?.timezone || req.user.timezone)
		rule.name = req.body.name
		rule.enabled = req.body.enabled
		rule.trigger = { ...req.body.trigger, ...(schedule && { schedule, column: null }) }
		rule.actions = req.body.actions
		rule.nextRunAt = schedule && rule.enabled ? nextRunAfter(schedule) : null
		rule.lastError = ''
		await rule.save()
		await rule.populate('createdBy', 'name email avatar')
		announce(access.board._id)
		return res.status(200).json(shown(rule, req, access.role))
	} catch (error) {
		return respondError(res, error, 'Could not save the rule')
	}
}

/** PATCH /boards/:id/rules/:ruleId — on or off. */
export const toggleRule = async (req, res) => {
	try {
		const access = await boardAccess(req)
		const rule = await ruleOf(req, access)
		rule.enabled = req.body.enabled
		rule.nextRunAt = rule.trigger.type === 'schedule' && rule.enabled ? nextRunAfter(rule.trigger.schedule) : null
		if (rule.enabled) rule.lastError = ''
		await rule.save()
		await rule.populate('createdBy', 'name email avatar')
		announce(access.board._id)
		return res.status(200).json(shown(rule, req, access.role))
	} catch (error) {
		return respondError(res, error, 'Could not change the rule')
	}
}

export const deleteRule = async (req, res) => {
	try {
		const access = await boardAccess(req)
		const rule = await ruleOf(req, access)
		await rule.deleteOne()
		announce(access.board._id)
		return res.status(204).send()
	} catch (error) {
		return respondError(res, error, 'Could not delete the rule')
	}
}

/** POST /boards/:id/rules/:ruleId/run — a scheduled rule, right now; its schedule stays as it is. */
export const runRule = async (req, res) => {
	try {
		const access = await boardAccess(req)
		const rule = await ruleOf(req, access)
		if (rule.trigger.type !== 'schedule') throw fail(400, 'Only scheduled rules can be run by hand')
		const result = await runRuleNow(rule.toObject())
		const updated = await BoardRule.findById(rule._id).populate('createdBy', 'name email avatar')
		return res.status(200).json({ ...result, rule: shown(updated, req, access.role) })
	} catch (error) {
		return respondError(res, error, 'Could not run the rule')
	}
}
