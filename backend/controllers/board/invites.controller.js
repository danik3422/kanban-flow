import crypto from 'node:crypto'
import mongoose from 'mongoose'

import { env } from '../../config/env.js'
import { sendBoardInviteEmail } from '../../emails/mailer.js'
import Board from '../../models/board.model.js'
import BoardInvite from '../../models/boardInvite.model.js'
import BoardMember from '../../models/boardMember.model.js'
import Column from '../../models/column.model.js'
import Task from '../../models/task.model.js'
import User from '../../models/user.model.js'
import { canManageBoard } from '../../services/boardAccess.service.js'
import { recordBoardActivity } from '../../services/boardActivity.service.js'

// Board invites: email invites, the shared invite link, and accepting an invite.

export const getBoardInvites = async (req, res) => {
	try {
		const board = req.board
		if (!(await canManageBoard(board, req.user._id)))
			return res
				.status(403)
				.json({ message: 'Only the board owner or an admin can view invites' })
		const invites = await BoardInvite.find({
			board: board._id,
			$or: [
				{ email: { $ne: '' } },
				{ email: '', visibilityVersion: Number(board.visibilityVersion || 0) },
			],
		})
			.sort({ createdAt: -1 })
			.select('email role expiresAt usedAt acceptedBy createdAt createdBy')
			.populate('acceptedBy', 'name email')
			.populate('createdBy', 'name email')
			.lean()
		return res
			.status(200)
			.json(
				invites.map((invite) => ({
					...invite,
					status: invite.usedAt
						? 'accepted'
						: invite.expiresAt <= new Date()
							? 'expired'
							: 'pending',
				})),
			)
	} catch (error) {
		console.error('Board invites fetch failed:', error)
		return res.status(500).json({ message: 'Could not load board invites' })
	}
}

export const getBoardInviteLink = async (req, res) => {
	try {
		const board = req.board
		if (!(await canManageBoard(board, req.user._id))) {
			return res.status(403).json({ message: 'Only the board owner or an admin can view the invite link' })
		}
		const invite = await BoardInvite.findOne({
			board: board._id,
			createdBy: req.user._id,
			email: '',
			usedAt: null,
			expiresAt: { $gt: new Date() },
			visibilityVersion: Number(board.visibilityVersion || 0),
		}).select('role createdBy createdAt expiresAt tokenVersion tokenHash')
		if (!invite) return res.status(404).json({ message: 'Invite link has not been created' })
		const rawToken = crypto
			.createHmac('sha256', env.jwtSecret)
			.update(`invite:${board._id.toString()}:${req.user._id.toString()}:${Number(invite.tokenVersion || 0)}`)
			.digest('hex')
		const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
		if (invite.tokenHash !== tokenHash) return res.status(404).json({ message: 'Invite link has been revoked' })
		return res.status(200).json({
			inviteId: invite._id,
			inviteUrl: `${env.frontendUrl}/invite/${rawToken}`,
			role: invite.role,
			createdBy: invite.createdBy,
			createdAt: invite.createdAt,
			expiresAt: invite.expiresAt,
		})
	} catch (error) {
		console.error('Board invite link lookup failed:', error)
		return res.status(500).json({ message: 'Could not load board invite link' })
	}
}

export const createBoardInvite = async (req, res) => {
	try {
		const board = await Board.findById(req.board._id)
		if (!(await canManageBoard(board, req.user._id)))
			return res
				.status(403)
				.json({ message: 'Only the board owner or an admin can create invites' })
		const email = (req.body.email || '').trim().toLowerCase()
		const role = req.body.role || 'member'
		if (!['admin', 'member'].includes(role)) {
			return res.status(400).json({ message: 'Invalid invite role' })
		}
		if (email && email === req.user.email.toLowerCase())
			return res.status(400).json({ message: 'You cannot invite yourself' })
		if (email) {
			const invitedUser = await User.findOne({ email }).select('_id')
			if (invitedUser) {
				const existingMember = await BoardMember.exists({
					board: board._id,
					user: invitedUser._id,
				})
				if (existingMember)
					return res
						.status(400)
						.json({ message: 'This user is already a member of the board' })
			}
			const activeInvite = await BoardInvite.exists({
				board: board._id,
				email,
				usedAt: null,
				expiresAt: { $gt: new Date() },
			})
			if (activeInvite)
				return res
					.status(400)
					.json({ message: 'An active invite already exists for this email' })
		} else {
			const existingNextVersion = Number(board.inviteTokenVersion || 0)
			const activeLinkInvite = await BoardInvite.findOne({
				board: board._id,
				createdBy: req.user._id,
				email: '',
				usedAt: null,
				expiresAt: { $gt: new Date() },
				visibilityVersion: Number(board.visibilityVersion || 0),
			})
			if (activeLinkInvite) {
				const existingToken = crypto
					.createHmac('sha256', env.jwtSecret)
					.update(`invite:${board._id.toString()}:${req.user._id.toString()}:${Number(activeLinkInvite.tokenVersion || 0)}`)
					.digest('hex')
				const existingTokenHash = crypto.createHash('sha256').update(existingToken).digest('hex')
				if (activeLinkInvite.tokenHash === existingTokenHash) {
					return res.status(201).json({
						inviteUrl: `${env.frontendUrl}/invite/${existingToken}`,
						emailSent: false,
						expiresInDays: 7,
					})
				}
				await activeLinkInvite.deleteOne()
			}
			const nextTokenVersion = existingNextVersion + 1
			const updatedBoard = await Board.findOneAndUpdate(
				{ _id: board._id },
				{ $set: { inviteTokenVersion: nextTokenVersion } },
				{ new: true },
			)
			if (!updatedBoard) {
				return res.status(409).json({ message: 'Invite link changed. Please try again.' })
			}
			board.inviteTokenVersion = nextTokenVersion
		}
		let rawToken = crypto.randomBytes(32).toString('hex')
		let tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
		let tokenVersion = 0
		if (!email) {
			tokenVersion = Number(board.inviteTokenVersion || 0)
			rawToken = crypto
				.createHmac('sha256', env.jwtSecret)
				.update(`invite:${board._id.toString()}:${req.user._id.toString()}:${tokenVersion}`)
				.digest('hex')
			tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
		}
		const invite = await BoardInvite.create({
			board: board._id,
			email,
			role,
			tokenHash,
			tokenVersion,
			createdBy: req.user._id,
			visibilityVersion: Number(board.visibilityVersion || 0),
			expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
		})
		await recordBoardActivity({
			boardId: board._id,
			userId: req.user._id,
			action: 'created invite',
			entityType: 'invite',
			entityId: invite._id,
			entityName: email || 'Anyone with the link',
			details: email ? `invited ${email}` : 'created a share link invite',
		})
		const inviteUrl = `${env.frontendUrl}/invite/${rawToken}`
		let emailSent = false
		if (email) {
			try {
				// In the invitee's language when they already have an account, else the inviter's.
				const invitee = await User.findOne({ email }).select('language').lean()
				await sendBoardInviteEmail({
					email,
					boardName: board.name,
					boardUrl: inviteUrl,
					inviterName: req.user.name || req.user.email,
					language: invitee?.language || req.user.language,
				})
				emailSent = true
			} catch (error) {
				console.warn('Invite email was not sent:', error.message)
			}
		}
		return res.status(201).json({ inviteUrl, emailSent, expiresInDays: 7 })
	} catch (error) {
		console.error('Board invite creation failed:', error)
		return res.status(500).json({ message: 'Could not create board invite' })
	}
}

export const revokeBoardInvite = async (req, res) => {
	try {
		const board = req.board
		if (!(await canManageBoard(board, req.user._id)))
			return res
				.status(403)
				.json({ message: 'Only the board owner or an admin can revoke invites' })
		const invite = await BoardInvite.findOne({
			_id: req.params.inviteId,
			board: board._id,
			usedAt: null,
		})
		if (!invite)
			return res.status(404).json({ message: 'Pending invite not found' })
		// The owner can take back any invite, including one an admin made.
		const isOwner = board.createdBy.toString() === req.user._id.toString()
		if (!isOwner && invite.createdBy.toString() !== req.user._id.toString())
			return res.status(403).json({ message: 'Only the creator can revoke this invite' })
		await invite.deleteOne()
		await recordBoardActivity({
			boardId: board._id,
			userId: req.user._id,
			action: 'revoked invite',
			entityType: 'invite',
			entityId: invite._id,
			entityName: invite.email || 'Anyone with the link',
			details: 'revoked a board invite',
		})
		return res.status(200).json({ message: 'Invite revoked' })
	} catch (error) {
		console.error('Board invite revoke failed:', error)
		return res.status(500).json({ message: 'Could not revoke board invite' })
	}
}

/** Send an email invitation again: a fresh link, seven more days, a new email. */
export const resendBoardInvite = async (req, res) => {
	try {
		const board = req.board
		if (!(await canManageBoard(board, req.user._id))) {
			return res.status(403).json({ message: 'Only the board owner or an admin can resend invites' })
		}
		if (!mongoose.Types.ObjectId.isValid(req.params.inviteId)) return res.status(404).json({ message: 'Pending invite not found' })
		const invite = await BoardInvite.findOne({ _id: req.params.inviteId, board: board._id, usedAt: null, email: { $ne: '' } })
		if (!invite) return res.status(404).json({ message: 'Pending invite not found' })
		const rawToken = crypto.randomBytes(32).toString('hex')
		invite.tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
		invite.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
		await invite.save()
		const inviteUrl = `${env.frontendUrl}/invite/${rawToken}`
		let emailSent = false
		try {
			const invitee = await User.findOne({ email: invite.email }).select('language').lean()
			await sendBoardInviteEmail({ email: invite.email, boardName: board.name, boardUrl: inviteUrl, inviterName: req.user.name || req.user.email, language: invitee?.language || req.user.language })
			emailSent = true
		} catch (error) {
			console.warn('Invite email was not resent:', error.message)
		}
		await recordBoardActivity({
			boardId: board._id,
			userId: req.user._id,
			action: 'resent invite',
			entityType: 'invite',
			entityId: invite._id,
			entityName: invite.email,
			details: `resent the invitation to ${invite.email}`,
		})
		return res.status(200).json({ emailSent, expiresAt: invite.expiresAt })
	} catch (error) {
		console.error('Board invite resend failed:', error)
		return res.status(500).json({ message: 'Could not resend the invitation' })
	}
}

export const copyBoardInviteLink = async (req, res) => {
	try {
		const board = req.board
		if (!(await canManageBoard(board, req.user._id)))
			return res
				.status(403)
				.json({ message: 'Only the board owner or an admin can copy invites' })

		const invite = await BoardInvite.findOne({
			_id: req.params.inviteId,
			board: board._id,
			usedAt: null,
			expiresAt: { $gt: new Date() },
		})

		if (!invite) {
			return res.status(404).json({ message: 'Pending invite not found' })
		}
		if (!invite.email && invite.createdBy.toString() !== req.user._id.toString())
			return res.status(403).json({ message: 'Only the creator can copy this invite link' })

		let rawToken = crypto.randomBytes(32).toString('hex')
		if (!invite.email) {
			invite.tokenVersion = Number(invite.tokenVersion || 0) + 1
			rawToken = crypto
				.createHmac('sha256', env.jwtSecret)
				.update(`invite:${board._id.toString()}:${req.user._id.toString()}:${invite.tokenVersion}`)
				.digest('hex')
		}
		const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
		invite.tokenHash = tokenHash
		invite.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
		await invite.save()
		await recordBoardActivity({
			boardId: board._id,
			userId: req.user._id,
			action: 'copied invite link',
			entityType: 'invite',
			entityId: invite._id,
			entityName: invite.email || 'Anyone with the link',
			details: 'copied a board invite link',
		})

		const inviteUrl = `${env.frontendUrl}/invite/${rawToken}`
		return res.status(200).json({ inviteUrl, expiresInDays: 7 })
	} catch (error) {
		console.error('Board invite copy failed:', error)
		return res.status(500).json({ message: 'Could not copy board invite link' })
	}
}

// "dana@example.com" -> "d•••@example.com": enough to recognise, not to harvest.
const maskEmail = (email = '') => {
	const [name, domain] = String(email).split('@')
	return domain ? `${name.slice(0, 1)}•••@${domain}` : ''
}

// Who is looking at an invite decides what the page offers them.
const inviteViewerStatus = async (invite, board, user) => {
	if (!user) return null
	if (board.createdBy?.toString() === user._id.toString()) return 'owner'
	if (await BoardMember.exists({ board: board._id, user: user._id })) return 'member'
	if (invite.email && invite.email !== String(user.email || '').toLowerCase()) return 'wrong-email'
	return 'can-join'
}

export const getBoardInviteDetails = async (req, res) => {
	try {
		const tokenHash = crypto
			.createHash('sha256')
			.update(req.params.token)
			.digest('hex')

		const invite = await BoardInvite.findOne({
			tokenHash,
			usedAt: null,
			expiresAt: { $gt: new Date() },
		}).populate('board', 'name visibilityVersion createdBy background').populate('createdBy', 'name email avatar')

		if (!invite || !invite.board) {
			return res.status(400).json({ message: 'Invite expired or invalid' })
		}
		if (!invite.email && Number(invite.visibilityVersion || 0) !== Number(invite.board.visibilityVersion || 0)) {
			return res.status(400).json({ message: 'Invite expired or invalid' })
		}

		const board = invite.board
		const [memberships, memberCount, columns, viewer] = await Promise.all([
			BoardMember.find({ board: board._id }).sort({ createdAt: 1 }).limit(5).populate('user', 'name email avatar').lean(),
			BoardMember.countDocuments({ board: board._id }),
			Column.find({ board: board._id }).select('_id').lean(),
			inviteViewerStatus(invite, board, req.user),
		])
		const taskCount = columns.length ? await Task.countDocuments({ column: { $in: columns.map((column) => column._id) } }) : 0
		const inviter = invite.createdBy

		return res.status(200).json({
			boardId: board._id.toString(),
			boardName: board.name,
			background: board.background || null,
			invitedBy: inviter ? { name: inviter.name || '', email: inviter.name ? '' : inviter.email, avatar: inviter.avatar || '' } : null,
			role: invite.role,
			expiresAt: invite.expiresAt,
			emailHint: invite.email ? maskEmail(invite.email) : '',
			memberCount,
			taskCount,
			members: memberships
				.filter((membership) => membership.user)
				.map((membership) => ({ name: membership.user.name || maskEmail(membership.user.email), avatar: membership.user.avatar || '' })),
			viewer,
		})
	} catch (error) {
		console.error('Board invite details lookup failed:', error)
		return res.status(500).json({ message: 'Could not load invite details' })
	}
}

export const acceptBoardInvite = async (req, res) => {
	try {
		const tokenHash = crypto
			.createHash('sha256')
			.update(req.params.token)
			.digest('hex')
		const userEmail = req.user.email.toLowerCase()
		const invite = await BoardInvite.findOne({
			tokenHash,
			usedAt: null,
			expiresAt: { $gt: new Date() },
		})

		if (!invite)
			return res.status(400).json({ message: 'Invite expired or invalid' })
		if (invite.email && invite.email !== userEmail) {
			return res.status(403).json({ message: 'This invite was sent to a different email address.', code: 'wrong-email' })
		}

		const board = await Board.findById(invite.board).select('createdBy name visibilityVersion')
		if (!board) {
			return res.status(404).json({ message: 'Board not found.' })
		}
		if (!invite.email && Number(invite.visibilityVersion || 0) !== Number(board.visibilityVersion || 0)) {
			return res.status(400).json({ message: 'Invite expired or invalid' })
		}

		if (board.createdBy.toString() === req.user._id.toString()) {
			return res.status(400).json({
				message: 'You cannot invite yourself to this board.',
				boardId: board._id.toString(),
			})
		}

		const alreadyMember = await BoardMember.exists({
			board: invite.board,
			user: req.user._id,
		})
		if (alreadyMember) {
			return res.status(400).json({
				message: 'You are already a member of this board.',
				boardId: board._id.toString(),
			})
		}

		const claimFilter = {
			_id: invite._id,
			usedAt: null,
			expiresAt: { $gt: new Date() },
		}
		if (!invite.email) claimFilter.visibilityVersion = Number(board.visibilityVersion || 0)
		const claimedInvite = await BoardInvite.findOneAndUpdate(
					claimFilter,
					{ $set: { usedAt: new Date(), acceptedBy: req.user._id } },
					{ returnDocument: 'after' },
				)
				if (!claimedInvite) {
					return res.status(400).json({ message: 'Invite expired or invalid' })
				}
		await BoardMember.updateOne(
			{ board: invite.board, user: req.user._id },
			{ $setOnInsert: { role: invite.role || 'member' } },
			{ upsert: true },
		)
		await recordBoardActivity({
			boardId: invite.board,
			userId: req.user._id,
			action: 'joined',
			entityType: 'member',
			entityId: req.user._id,
			entityName: req.user.name || req.user.email,
			details: `joined this board from an invite created by ${invite.createdBy?.name || invite.createdBy?.email || 'a board admin'}`,
		})
		return res
			.status(200)
			.json({ boardId: invite.board.toString(), message: 'Invite accepted' })
	} catch (error) {
		console.error('Board invite acceptance failed:', error)
		return res.status(500).json({ message: 'Could not accept board invite' })
	}
}
