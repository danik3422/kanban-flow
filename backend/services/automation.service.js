import { emitBoardEvent } from '../lib/realtime.js'
import Board from '../models/board.model.js'
import BoardMember from '../models/boardMember.model.js'
import BoardRule from '../models/boardRule.model.js'
import Column from '../models/column.model.js'
import Task from '../models/task.model.js'
import TaskActivity from '../models/taskActivity.model.js'
import User from '../models/user.model.js'
import { getBoardRole, validateBoardAssignees } from './boardAccess.service.js'
import { boardCardLimitMessage, exceedsBoardCardLimit, MAX_TASKS_PER_COLUMN } from './limits.service.js'
import { startNextInSeries, takeBackNextInSeries } from './repeatingCards.service.js'
import { dayKeyIn, nextRunAfter } from './schedule.service.js'
import { emitCommentCount, notifyTaskAssignees, populatedTask, recordTaskActivity } from './taskEvents.service.js'

// Board automation. A card rule answers something that happened to a card ("added to
// Done") with actions on that card; a scheduled rule acts on the board at set times.
// What a rule does can set off other rules (moved to Done → another rule archives it),
// up to a few steps, and each rule at most once per chain, so rules never loop.

export const CARD_TRIGGERS = ['card_added', 'card_created', 'card_moved', 'card_completed', 'checklist_done']
export const CARD_ACTIONS = ['move', 'complete', 'reopen', 'add_label', 'remove_label', 'clear_labels', 'assign', 'assign_actor', 'unassign_all', 'set_due', 'clear_due', 'set_priority', 'check_all', 'comment', 'archive']
export const BOARD_ACTIONS = ['create_card', 'move_list', 'archive_list']
export const MAX_RULES_PER_BOARD = 50
const MAX_CHAIN = 5
const MAX_LIST_CARDS = 500

const same = (left, right) => Boolean(left && right) && left.toString() === right.toString()
const dueIn = (days, timezone, now = new Date()) => new Date(Date.parse(`${dayKeyIn(now, timezone)}T00:00:00Z`) + days * 86400000)

// Requests return before their rules finish; tests wait for them here.
const running = new Set()
const track = (promise) => {
	running.add(promise)
	promise.finally(() => running.delete(promise))
	return promise
}
export const automationsIdle = async () => {
	while (running.size) await Promise.allSettled([...running])
}

/** True when a card event (`created`, `moved`, `completed`, `checklist_done`) sets the trigger off. */
export const triggerMatches = (trigger, event) => {
	const listMatches = !trigger.column || same(trigger.column, event.column)
	switch (trigger.type) {
		case 'card_added': return (event.type === 'created' || event.type === 'moved') && listMatches
		case 'card_created': return event.type === 'created' && listMatches
		case 'card_moved': return event.type === 'moved' && listMatches
		case 'card_completed': return event.type === 'completed' && listMatches
		case 'checklist_done': return event.type === 'checklist_done' && listMatches
		default: return false
	}
}

/** Puts a card at the top or bottom of a list, closing the gap it leaves. */
const placeCard = async (task, target, position) => {
	const fromColumn = task.column
	const fromPosition = task.position
	const moving = !same(fromColumn, target._id)
	if (moving && await Task.countDocuments({ column: target._id }) >= MAX_TASKS_PER_COLUMN) return false
	// Updates are not filtered by the archive (models/archivable.js): leave archived cards be.
	await Task.updateMany({ column: fromColumn, _id: { $ne: task._id }, position: { $gt: fromPosition }, archivedAt: null }, { $inc: { position: -1 } })
	if (position === 'top') {
		await Task.updateMany({ column: target._id, _id: { $ne: task._id }, archivedAt: null }, { $inc: { position: 1 } })
		task.position = 0
	} else {
		task.position = await Task.countDocuments({ column: target._id, _id: { $ne: task._id } })
	}
	task.column = target._id
	return true
}

/**
 * Carries out a card rule's actions on the card. Returns what changed (for the card's
 * history), the events that may set off further rules, and what to tell the board.
 */
const applyCardActions = async ({ rule, task, board, actor, columns }) => {
	const done = []
	const events = []
	const skipped = []
	const effects = { moved: false, archived: false, assigned: [], series: null, comment: false }
	for (const action of rule.actions) {
		switch (action.type) {
			case 'move': {
				const target = columns.find((column) => same(column._id, action.column))
				if (!target) {
					skipped.push('list')
					break
				}
				const before = task.column.toString()
				if (!(await placeCard(task, target, action.position))) {
					skipped.push('full')
					break
				}
				effects.moved = true
				done.push('move')
				if (before !== target._id.toString()) events.push({ type: 'moved', column: target._id, fromColumn: before })
				break
			}
			case 'complete':
				if (!task.completed) {
					task.completed = true
					task.completedAt = new Date()
					done.push('complete')
					events.push({ type: 'completed', column: task.column })
					if (task.repeat?.frequency && !task.repeatedTo) effects.series = 'next'
				}
				break
			case 'reopen':
				if (task.completed) {
					task.completed = false
					task.completedAt = null
					done.push('reopen')
					if (task.repeatedTo) effects.series = 'back'
				}
				break
			case 'add_label':
				if (!board.labels.some((label) => label.name === action.label)) skipped.push('label')
				else if (!task.labels.includes(action.label)) {
					task.labels.push(action.label)
					done.push('add_label')
				}
				break
			case 'remove_label':
				if (task.labels.includes(action.label)) {
					task.labels = task.labels.filter((label) => label !== action.label)
					done.push('remove_label')
				}
				break
			case 'clear_labels':
				if (task.labels.length) {
					task.labels = []
					done.push('clear_labels')
				}
				break
			case 'assign':
			case 'assign_actor': {
				const wanted = action.type === 'assign_actor' ? (actor ? [actor._id] : []) : (action.users || [])
				const onBoard = []
				for (const userId of wanted) if (await validateBoardAssignees(board, [userId])) onBoard.push(userId)
				if (onBoard.length < wanted.length) skipped.push('person')
				const added = onBoard.filter((userId) => !task.assignees.some((assignee) => same(assignee, userId)))
				if (added.length) {
					task.assignees.push(...added)
					effects.assigned.push(...added)
					done.push('assign')
				}
				break
			}
			case 'unassign_all':
				if (task.assignees.length) {
					task.assignees = []
					done.push('unassign_all')
				}
				break
			case 'set_due': {
				const dueDate = dueIn(action.days || 0, actor?.timezone || 'UTC')
				if (!task.dueDate || task.dueDate.getTime() !== dueDate.getTime()) {
					task.dueDate = dueDate
					task.dueReminderSentAt = null
					done.push('set_due')
				}
				break
			}
			case 'clear_due':
				if (task.dueDate) {
					task.dueDate = null
					task.dueReminderSentAt = null
					done.push('clear_due')
				}
				break
			case 'set_priority':
				if (task.priority !== action.priority) {
					task.priority = action.priority
					done.push('set_priority')
				}
				break
			case 'check_all':
				if (task.checklist.some((item) => !item.completed)) {
					task.checklist.forEach((item) => {
						item.completed = true
					})
					done.push('check_all')
					events.push({ type: 'checklist_done', column: task.column })
				}
				break
			case 'comment':
				await TaskActivity.create({ task: task._id, board: board._id, user: rule.createdBy, type: 'comment', message: action.text, rule: rule._id })
				effects.comment = true
				done.push('comment')
				break
			case 'archive':
				await Task.updateMany({ column: task.column, _id: { $ne: task._id }, position: { $gt: task.position }, archivedAt: null }, { $inc: { position: -1 } })
				task.archivedAt = new Date()
				task.archivedBy = rule.createdBy
				task.archivedWithColumn = false
				effects.archived = true
				done.push('archive')
				break
			default:
				break
		}
		if (effects.archived) break
	}
	return { done, events, skipped, effects }
}

const recordRun = (rule, skipped) => BoardRule.updateOne(
	{ _id: rule._id },
	{ $inc: { runs: 1 }, $set: { lastRunAt: new Date(), lastError: skipped[0] || '' } },
)

/**
 * Runs the board's card rules for things that just happened to a card. `actor` is the
 * person whose change it was; the rules act on their behalf.
 */
const runCardRules = async ({ boardId, taskId, events, actor }) => {
	const found = await BoardRule.find({ board: boardId, enabled: true, 'trigger.type': { $in: CARD_TRIGGERS } }).lean()
	if (!found.length) return
	const board = await Board.findById(boardId)
	if (!board) return
	// A rule acts in its author's name (its comments are theirs): once they leave the board, it stops.
	const authors = new Set([String(board.createdBy), ...(await BoardMember.find({ board: boardId, user: { $in: found.map((rule) => rule.createdBy) } }).distinct('user')).map(String)])
	const orphaned = found.filter((rule) => !authors.has(String(rule.createdBy)))
	if (orphaned.length) {
		await BoardRule.updateMany({ _id: { $in: orphaned.map((rule) => rule._id) } }, { $set: { enabled: false, lastError: 'author' } })
		emitBoardEvent(boardId.toString(), 'board:rules-changed', {})
	}
	const rules = found.filter((rule) => authors.has(String(rule.createdBy)))
	if (!rules.length) return
	const columns = await Column.find({ board: boardId }).select('title').lean()
	const fired = new Set()
	let pending = events
	let changed = false
	let reload = false
	for (let step = 0; step < MAX_CHAIN && pending.length; step++) {
		const next = []
		for (const event of pending) {
			for (const rule of rules) {
				if (fired.has(rule._id.toString()) || !triggerMatches(rule.trigger, event)) continue
				const task = await Task.findById(taskId)
				if (!task) return finish()
				fired.add(rule._id.toString())
				const fromTitle = columns.find((column) => same(column._id, task.column))?.title || ''
				const { done, events: caused, skipped, effects } = await applyCardActions({ rule, task, board, actor, columns })
				await recordRun(rule, skipped)
				if (!done.length) continue
				await task.save()
				changed = true
				reload ||= effects.moved || effects.archived
				const toTitle = columns.find((column) => same(column._id, task.column))?.title || ''
				await recordTaskActivity({
					taskId: task._id,
					boardId,
					userId: actor?._id || rule.createdBy,
					type: 'automation',
					message: rule.name || '',
					fields: done,
					...(effects.moved && fromTitle !== toTitle && { fromColumn: fromTitle, toColumn: toTitle }),
				})
				if (effects.comment) await emitCommentCount(boardId, task._id)
				if (effects.series === 'next') await startNextInSeries(task, boardId, actor || { _id: rule.createdBy, timezone: 'UTC' })
				if (effects.series === 'back') await takeBackNextInSeries(task, boardId)
				if (effects.assigned.length) {
					await notifyTaskAssignees({ userIds: effects.assigned.filter((userId) => !same(userId, actor?._id)), task: await populatedTask(task._id), board, actorId: actor?._id || rule.createdBy })
				}
				if (effects.archived) {
					emitBoardEvent(boardId.toString(), 'task:deleted', { taskId: task._id.toString() })
					return finish()
				}
				next.push(...caused)
			}
		}
		pending = next
	}
	return finish()

	async function finish() {
		if (!changed) return
		if (reload) emitBoardEvent(boardId.toString(), 'board:content-changed', { reason: 'automation' })
		else {
			const task = await populatedTask(taskId)
			if (task) emitBoardEvent(boardId.toString(), 'task:updated', task)
		}
	}
}

/**
 * Card rules for changes a person just made: one `{ boardId, taskId, events, actor }`
 * or several, run one after another. Runs after the request has answered; a failing
 * rule never breaks the change itself.
 */
export const runCardAutomations = (changes) => {
	const list = (Array.isArray(changes) ? changes : [changes]).filter((change) => change?.events?.length)
	if (!list.length) return Promise.resolve()
	return track((async () => {
		for (const change of list) {
			try {
				await runCardRules(change)
			} catch (error) {
				console.error('Automation failed:', error)
			}
		}
	})())
}

/** Placeholders a new card's title may use: {date} is the day the rule runs. */
const fillTitle = (title, timezone, language, now) => title.replace(/\{date\}/g, new Intl.DateTimeFormat(language || 'en', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${dayKeyIn(now, timezone)}T00:00:00Z`)))

/** A scheduled rule's actions, on behalf of the person who made it. */
const runBoardRule = async (rule, now = new Date()) => {
	const board = await Board.findById(rule.board)
	if (!board) {
		await BoardRule.deleteOne({ _id: rule._id })
		return { skipped: ['board'] }
	}
	const author = await User.findById(rule.createdBy).select('name timezone language').lean()
	if (!author || !(await getBoardRole(board, author._id))) {
		await BoardRule.updateOne({ _id: rule._id }, { $set: { enabled: false, lastError: 'author' } })
		emitBoardEvent(board._id.toString(), 'board:rules-changed', {})
		return { skipped: ['author'] }
	}
	const columns = await Column.find({ board: board._id }).select('title').lean()
	const skipped = []
	const created = []
	const moved = []
	let changed = false
	for (const action of rule.actions) {
		const target = columns.find((column) => same(column._id, action.column))
		if (!target) {
			skipped.push('list')
			continue
		}
		if (action.type === 'create_card') {
			if (await exceedsBoardCardLimit(board._id)) {
				skipped.push('full')
				console.warn(boardCardLimitMessage)
				continue
			}
			const count = await Task.countDocuments({ column: target._id })
			if (count >= MAX_TASKS_PER_COLUMN) {
				skipped.push('full')
				continue
			}
			const assignees = []
			for (const userId of action.users || []) if (await validateBoardAssignees(board, [userId])) assignees.push(userId)
			if (assignees.length < (action.users || []).length) skipped.push('person')
			if (action.position === 'top') await Task.updateMany({ column: target._id, archivedAt: null }, { $inc: { position: 1 } })
			const task = await Task.create({
				column: target._id,
				position: action.position === 'top' ? 0 : count,
				title: fillTitle(action.title, author.timezone, author.language, now).slice(0, 200),
				description: action.text || '',
				labels: (action.labels || []).filter((name) => board.labels.some((label) => label.name === name)),
				assignees,
				dueDate: Number.isInteger(action.days) ? dueIn(action.days, author.timezone, now) : null,
			})
			await recordTaskActivity({ taskId: task._id, boardId: board._id, userId: author._id, type: 'automation', message: rule.name || '', fields: ['create_card'], toColumn: target.title })
			const shown = await populatedTask(task._id)
			emitBoardEvent(board._id.toString(), 'task:created', shown)
			if (assignees.length) await notifyTaskAssignees({ userIds: assignees, task: shown, board, actorId: author._id })
			created.push(task._id)
			changed = true
		} else if (action.type === 'move_list') {
			const source = columns.find((column) => same(column._id, action.from))
			if (!source) {
				skipped.push('list')
				continue
			}
			if (same(source._id, target._id)) continue
			const tasks = await Task.find({ column: source._id }).select('_id').sort({ position: 1, createdAt: 1 }).limit(MAX_LIST_CARDS).lean()
			const offset = await Task.countDocuments({ column: target._id })
			const room = Math.max(0, MAX_TASKS_PER_COLUMN - offset)
			if (room < tasks.length) skipped.push('full')
			const moving = tasks.slice(0, room)
			if (!moving.length) continue
			await Task.bulkWrite(moving.map((task, index) => ({ updateOne: { filter: { _id: task._id }, update: { $set: { column: target._id, position: offset + index } } } })))
			const left = await Task.find({ column: source._id }).select('_id').sort({ position: 1, createdAt: 1 }).lean()
			if (left.length) await Task.bulkWrite(left.map((task, index) => ({ updateOne: { filter: { _id: task._id }, update: { $set: { position: index } } } })))
			for (const task of moving) {
				await recordTaskActivity({ taskId: task._id, boardId: board._id, userId: author._id, type: 'automation', message: rule.name || '', fields: ['move'], fromColumn: source.title, toColumn: target.title })
				moved.push({ taskId: task._id, column: target._id })
			}
			changed = true
		} else if (action.type === 'archive_list') {
			const filter = { column: target._id, ...(action.onlyDone && { completed: true }) }
			const tasks = await Task.find(filter).select('_id').limit(MAX_LIST_CARDS).lean()
			if (!tasks.length) continue
			const now = new Date()
			await Task.updateMany({ _id: { $in: tasks.map((task) => task._id) } }, { $set: { archivedAt: now, archivedBy: author._id, archivedWithColumn: false } })
			const left = await Task.find({ column: target._id }).select('_id').sort({ position: 1, createdAt: 1 }).lean()
			if (left.length) await Task.bulkWrite(left.map((task, index) => ({ updateOne: { filter: { _id: task._id }, update: { $set: { position: index } } } })))
			for (const task of tasks) await recordTaskActivity({ taskId: task._id, boardId: board._id, userId: author._id, type: 'automation', message: rule.name || '', fields: ['archive'] })
			changed = true
		}
	}
	await recordRun(rule, skipped)
	if (changed) emitBoardEvent(board._id.toString(), 'board:content-changed', { reason: 'automation' })
	// New and moved cards can set off the board's card rules in turn.
	const actor = { ...author, _id: author._id }
	for (const taskId of created) await runCardRules({ boardId: board._id, taskId, events: [{ type: 'created', column: (await Task.findById(taskId).select('column').lean())?.column }], actor })
	for (const { taskId, column } of moved) await runCardRules({ boardId: board._id, taskId, events: [{ type: 'moved', column }], actor })
	return { skipped, created: created.length, moved: moved.length }
}

/** Runs a scheduled rule now ("Run now"), without moving its next run. */
export const runRuleNow = (rule) => track(runBoardRule(rule))

/**
 * Every scheduled rule whose time has come. Each run is claimed first (its next run
 * moved on), so two servers never run a rule twice.
 */
export const runScheduledAutomations = async ({ now = new Date() } = {}) => {
	const due = await BoardRule.find({ enabled: true, 'trigger.type': 'schedule', nextRunAt: { $ne: null, $lte: now } }).limit(100).lean()
	let ran = 0
	for (const rule of due) {
		const claimed = await BoardRule.findOneAndUpdate(
			{ _id: rule._id, nextRunAt: rule.nextRunAt },
			{ $set: { nextRunAt: nextRunAfter(rule.trigger.schedule, now) } },
		)
		if (!claimed) continue
		try {
			await runBoardRule(rule, now)
			ran += 1
		} catch (error) {
			console.error('Scheduled automation failed:', error)
		}
	}
	return ran
}

let timer = null

/** Checks for scheduled rules every minute. Not started in tests. */
export const startAutomationJobs = () => {
	if (timer) return
	const tick = () => runScheduledAutomations().catch((error) => console.error('Automation jobs failed:', error.message))
	timer = setInterval(tick, Number(process.env.AUTOMATION_INTERVAL_MS) || 60 * 1000)
	timer.unref?.()
	void tick()
}
