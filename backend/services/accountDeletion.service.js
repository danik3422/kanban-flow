import Board from '../models/board.model.js'
import BoardMember from '../models/boardMember.model.js'
import Notification from '../models/notification.model.js'
import PasswordResetToken from '../models/passwordResetToken.model.js'
import TimeEntry from '../models/timeEntry.model.js'
import User from '../models/user.model.js'
import { deleteBoardForGood, removePersonFromBoard } from './boardLifecycle.service.js'
import { deleteImage } from './fileStorage.service.js'
import { endOtherSessions } from './sessions.service.js'

// Deleting an account. Boards only this person uses go entirely. On boards shared with
// others the person leaves; what they wrote there (cards, comments, logged time) stays
// for the team but no longer names them. The account record itself is emptied of
// everything personal rather than removed, so that shared history still points somewhere.

export const DELETED_NAME = 'Deleted user'

/** Names of boards this person owns that other people also use. */
export const sharedOwnedBoards = async (userId) => {
	const owned = await Board.find({ createdBy: userId }).select('_id name').lean()
	const shared = await BoardMember.find({ board: { $in: owned.map((board) => board._id) }, user: { $ne: userId } }).distinct('board')
	const sharedIds = new Set(shared.map((id) => id.toString()))
	return owned.filter((board) => sharedIds.has(board._id.toString())).map((board) => board.name)
}

export const deleteAccountData = async (user) => {
	const userId = user._id
	// Someone else's work must never disappear with this account: those boards are handed
	// over (or deleted) by the owner first.
	const shared = await sharedOwnedBoards(userId)
	if (shared.length) {
		const error = new Error('Hand over or delete the boards you share with others first.')
		error.statusCode = 409
		error.code = 'owns_shared_boards'
		error.boards = shared
		throw error
	}
	for (const board of await Board.find({ createdBy: userId })) await deleteBoardForGood(board, userId)
	const memberships = await BoardMember.find({ user: userId }).distinct('board')
	for (const board of await Board.find({ _id: { $in: memberships } })) {
		await removePersonFromBoard(board, user, { reason: 'account-deleted' })
	}

	const record = await User.findById(userId).select('avatar')
	await Promise.all([
		Notification.deleteMany({ user: userId }),
		PasswordResetToken.deleteMany({ user: userId }),
		// A timer still running was never counted on its card.
		TimeEntry.deleteMany({ user: userId, endedAt: null }),
	])
	await User.updateOne({ _id: userId }, {
		$set: {
			email: `deleted-${userId}@deleted.invalid`,
			name: DELETED_NAME,
			jobTitle: '',
			avatar: '',
			password: null,
			hasPassword: false,
			linkedProviders: [],
			passkeys: [],
			passkeyRegistrationChallenge: '',
			emailVerificationTokenHash: '',
			emailNotifications: false,
			emailFrequency: 'never',
			desktopNotifications: false,
			taskNotifications: false,
			weeklyDigest: false,
			deletedAt: new Date(),
		},
		$unset: { providerUid: '', calendarTokenHash: '' },
		// Every cookie this account ever had stops working.
		$inc: { sessionVersion: 1, calendarTokenVersion: 1 },
	})
	await endOtherSessions(userId)
	if (record?.avatar) void deleteImage(record.avatar)
}
