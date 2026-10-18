import { env } from '../config/env.js'
import Board from '../models/board.model.js'
import BoardMember from '../models/boardMember.model.js'
import Column from '../models/column.model.js'
import Notification from '../models/notification.model.js'
import Task from '../models/task.model.js'
import User from '../models/user.model.js'
import { sendDigestEmail } from './mailer.js'
import { emailFrequencyOf, notifyTaskRecipients, wantsEmailFor } from './notificationDelivery.js'

const MINUTE = 60 * 1000
const DIGEST_INTERVAL = (Number(process.env.EMAIL_DIGEST_MINUTES) || 60) * MINUTE
// A burst of activity lands in one digest rather than the first item alone.
const DIGEST_GATHER = 5 * MINUTE

const accessibleBoardIds = async (userId) => new Set([
	...(await Board.find({ createdBy: userId }).distinct('_id')),
	...(await BoardMember.find({ user: userId }).distinct('board')),
].map((id) => id.toString()))

/**
 * Sends each "periodically" reader one email with everything waiting for them, at most
 * once per interval. Items read in the app, no longer wanted or from boards they left
 * are dropped. `force` skips the waiting (used by the dev trigger and tests).
 */
export const runEmailDigests = async ({ now = new Date(), force = false } = {}) => {
	const userIds = await Notification.distinct('user', { emailStatus: 'pending' })
	let sent = 0
	for (const userId of userIds) {
		const user = await User.findById(userId).select('email language timezone emailFrequency emailNotifications emailPreferences lastDigestSentAt').lean()
		const pending = await Notification.find({ user: userId, emailStatus: 'pending' }).sort({ createdAt: 1 }).lean()
		if (!user || !pending.length) continue
		const frequency = emailFrequencyOf(user)
		if (!force) {
			if (frequency === 'periodic' && user.lastDigestSentAt && now - user.lastDigestSentAt < DIGEST_INTERVAL) continue
			if (now - pending[0].createdAt < DIGEST_GATHER) continue
		}
		const boards = await accessibleBoardIds(userId)
		const keep = pending.filter((item) => !item.readAt && wantsEmailFor(user, item.type) && (!item.board || boards.has(item.board.toString())))
		const drop = pending.filter((item) => !keep.includes(item)).map((item) => item._id)
		if (drop.length) await Notification.updateMany({ _id: { $in: drop } }, { $set: { emailStatus: 'skipped' } })
		if (!keep.length) continue
		// Claim this user's digest, so two servers never send it twice.
		const claimed = await User.findOneAndUpdate(
			{ _id: userId, lastDigestSentAt: user.lastDigestSentAt ?? null },
			{ $set: { lastDigestSentAt: now } },
		)
		if (!claimed) continue
		try {
			await sendDigestEmail({ email: user.email, language: user.language, timezone: user.timezone, notifications: keep, since: user.lastDigestSentAt || keep[0].createdAt })
			await Notification.updateMany({ _id: { $in: keep.map((item) => item._id) } }, { $set: { emailStatus: 'sent', emailSentAt: now } })
			sent += 1
		} catch (error) {
			await User.updateOne({ _id: userId }, { $set: { lastDigestSentAt: user.lastDigestSentAt ?? null } })
			console.error('Digest email failed:', error.message)
		}
	}
	return sent
}

/**
 * Reminds assignees once when a card's due date is within a day. Cards in a board's
 * last list count as done and are left alone.
 */
export const runDueReminders = async ({ now = new Date() } = {}) => {
	const tasks = await Task.find({
		dueDate: { $ne: null, $lte: new Date(now.getTime() + 24 * 60 * MINUTE), $gte: new Date(now.getTime() - 24 * 60 * MINUTE) },
		dueReminderSentAt: null,
		'assignees.0': { $exists: true },
	}).select('title dueDate assignees column').limit(500).lean()
	let reminded = 0
	const lastColumnByBoard = new Map()
	for (const task of tasks) {
		const column = await Column.findById(task.column).select('board').lean()
		if (!column) continue
		const boardId = column.board.toString()
		if (!lastColumnByBoard.has(boardId)) {
			const last = await Column.findOne({ board: column.board }).sort({ position: -1 }).select('_id').lean()
			lastColumnByBoard.set(boardId, last?._id.toString())
		}
		// Claim first, so a second server never reminds twice.
		const claimed = await Task.findOneAndUpdate({ _id: task._id, dueReminderSentAt: null }, { $set: { dueReminderSentAt: now } })
		if (!claimed || lastColumnByBoard.get(boardId) === task.column.toString()) continue
		const board = await Board.findById(column.board).select('name createdBy').lean()
		if (!board) continue
		await notifyTaskRecipients({
			userIds: task.assignees,
			task,
			board,
			actorId: null,
			type: 'task_due_soon',
			title: 'Due soon',
			message: `“${task.title}” is due soon.`,
			details: { dueDate: task.dueDate },
		})
		reminded += 1
	}
	return reminded
}

let timer = null

/** Every few minutes: due reminders, then digests. Not started in tests. */
export const startEmailJobs = () => {
	if (timer) return
	const tick = async () => {
		try {
			await runDueReminders()
			await runEmailDigests()
		} catch (error) {
			console.error('Email jobs failed:', error.message)
		}
	}
	timer = setInterval(tick, Number(process.env.EMAIL_JOBS_INTERVAL_MS) || 5 * MINUTE)
	timer.unref?.()
	void tick()
}

export const emailJobsEnabled = () => Boolean(env.brevoApiKey && env.mailFrom)
