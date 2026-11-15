import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useI18n } from '../../../i18n'
import { translateCurrent, translateServerMessageCurrent } from '../../../i18n/translate'
import { axiosInstance } from '../../../lib/axios'
import { copyToClipboard } from '../../../lib/clipboard'
import { isDevAuthBypass } from '../../../lib/devMode'

const failToast = (error, key) => toast.error(translateServerMessageCurrent(error.response?.data?.message, key))

/**
 * Who is on the open board and how others get in: members and their roles, invites by
 * email, the invite link, the public view link and people to suggest. Owns that state;
 * the board page fills members and invites when a board opens and clears them on a switch.
 */
const useBoardSharing = ({ board, authUserId, canManage, isShareOpen, setBoards, setSelectedBoard }) => {
	const { t: tr } = useI18n()
	const [members, setMembers] = useState([])
	const [invites, setInvites] = useState([])
	const [inviteLink, setInviteLink] = useState(null)
	const [publicLink, setPublicLink] = useState('')
	const [suggestions, setSuggestions] = useState([])
	const boardId = board?._id

	const copyText = async (text, message) => {
		try {
			await copyToClipboard(text)
			toast.success(message)
		} catch {
			toast.error(tr('auth.errors.generic'))
		}
	}

	// The links depend on who may manage the board, not on its name, labels or background;
	// those change often and must not refetch the links each time.
	const visibility = board?.visibility
	useEffect(() => {
		if (!boardId || isDevAuthBypass || !canManage) return undefined
		let isCurrent = true
		axiosInstance
			.get(`/board/boards/${boardId}/invites/link`)
			.then(({ data }) => {
				if (isCurrent) setInviteLink(data)
			})
			.catch((error) => {
				if (isCurrent && error.response?.status === 404) setInviteLink(null)
			})
		return () => {
			isCurrent = false
		}
	}, [boardId, canManage, authUserId])

	useEffect(() => {
		if (!boardId || visibility !== 'public' || isDevAuthBypass || !canManage) return undefined
		let isCurrent = true
		axiosInstance
			.get(`/board/boards/${boardId}/public-link`)
			.then(({ data }) => {
				if (isCurrent) setPublicLink(data.publicUrl)
			})
			.catch((error) => {
				if (isCurrent && error.response?.status === 404) setPublicLink('')
			})
		return () => {
			isCurrent = false
		}
	}, [boardId, visibility, canManage, authUserId])

	// People from the person's other boards, offered while the share dialog is open.
	useEffect(() => {
		if (!isShareOpen || !canManage || isDevAuthBypass) return undefined
		let current = true
		axiosInstance.get('/board/team').then(({ data }) => {
			if (!current) return
			const seen = new Map()
			for (const entry of data) for (const member of entry.members || []) {
				const user = member.user
				if (user?.email && String(user._id) !== String(authUserId) && !seen.has(user.email)) seen.set(user.email, { name: user.name, email: user.email.toLowerCase(), avatar: user.avatar })
			}
			setSuggestions([...seen.values()])
		}).catch(() => {})
		return () => {
			current = false
		}
	}, [isShareOpen, canManage, authUserId])

	const loadInviteLink = async () => {
		if (!boardId || isDevAuthBypass) return
		try {
			const { data } = await axiosInstance.get(`/board/boards/${boardId}/invites/link`)
			setInviteLink(data)
		} catch (error) {
			if (error.response?.status === 404) setInviteLink(null)
		}
	}
	const reloadInvites = async () => {
		const { data } = await axiosInstance.get(`/board/boards/${boardId}/invites`)
		setInvites(data)
	}

	// Invites everyone listed; returns the addresses that could not be invited.
	const inviteByEmail = async (emails, role) => {
		const failed = []
		let invited = 0
		let notEmailed = 0
		for (const email of emails) {
			try {
				const { data } = await axiosInstance.post(`/board/boards/${boardId}/invites`, { email, role })
				invited += 1
				if (!data.emailSent) notEmailed += 1
			} catch (error) {
				failed.push(email)
				toast.error(`${email}: ${translateServerMessageCurrent(error.response?.data?.message, 'boardHeader.inviteError')}`)
			}
		}
		if (invited) {
			// The invites exist either way; a failed refresh of the list must not leave the dialog busy.
			await reloadInvites().catch(() => {})
			toast.success(invited === 1 && emails.length === 1 ? tr('boardHeader.sent', { email: emails[0] }) : tr('boardHeader.invitedMany', { count: invited }))
			if (notEmailed) toast.warning(tr('boardHeader.sentNoEmail'))
		}
		return failed
	}
	const resendInvite = async (invite) => {
		try {
			const { data } = await axiosInstance.post(`/board/boards/${boardId}/invites/${invite._id}/resend`)
			await reloadInvites()
			if (data.emailSent) toast.success(tr('boardHeader.resent', { email: invite.email }))
			else toast.warning(tr('boardHeader.sentNoEmail'))
		} catch (error) {
			failToast(error, 'boardHeader.inviteError')
		}
	}
	const copyInviteFor = async (invite) => {
		try {
			const { data } = await axiosInstance.post(`/board/boards/${boardId}/invites/${invite._id}/copy`)
			await copyText(data.inviteUrl, tr('boardHeader.linkCopied'))
			await reloadInvites()
		} catch (error) {
			failToast(error, 'auth.errors.generic')
		}
	}
	const cancelInvite = async (invite) => {
		try {
			await axiosInstance.delete(`/board/boards/${boardId}/invites/${invite._id}`)
			setInvites((current) => current.filter((item) => item._id !== invite._id))
			toast.success(tr('boardHeader.inviteRevoked'))
		} catch (error) {
			failToast(error, 'auth.errors.generic')
		}
	}

	const createInviteLink = async () => {
		try {
			const { data } = await axiosInstance.post(`/board/boards/${boardId}/invites`, { email: '', role: 'member' })
			await copyToClipboard(data.inviteUrl)
			await loadInviteLink()
			toast.success(tr('boardHeader.linkCreated'))
		} catch (error) {
			failToast(error, 'boardHeader.inviteError')
		}
	}
	const turnOffInviteLink = async () => {
		if (!inviteLink?.inviteId) return
		try {
			await axiosInstance.delete(`/board/boards/${boardId}/invites/${inviteLink.inviteId}`)
			setInviteLink(null)
			setInvites((current) => current.filter((invite) => invite._id !== inviteLink.inviteId))
			toast.success(tr('boardHeader.linkRevoked'))
		} catch (error) {
			failToast(error, 'auth.errors.generic')
		}
	}
	const createViewLink = async () => {
		try {
			const { data } = await axiosInstance.post(`/board/boards/${boardId}/public-link`)
			setPublicLink(data.publicUrl)
			await copyText(data.publicUrl, tr('boardHeader.publicCopied'))
		} catch (error) {
			failToast(error, 'auth.errors.generic')
		}
	}
	const turnOffViewLink = async () => {
		try {
			await axiosInstance.delete(`/board/boards/${boardId}/public-link`)
			setPublicLink('')
			toast.success(tr('boardHeader.publicRevoked'))
		} catch (error) {
			failToast(error, 'auth.errors.generic')
		}
	}

	// Becoming owner is confirmed in the share dialog before this runs.
	const changeMemberRole = async (member, role) => {
		const memberId = member._id
		if (isDevAuthBypass) {
			setMembers((current) => current.map((item) => (item._id === memberId ? { ...item, role } : item)))
			toast.success(translateCurrent('workspace.memberRoleUpdated'))
			return
		}
		try {
			const { data } = await axiosInstance.patch(`/board/boards/${boardId}/members/${memberId}`, { role })
			if (data.ownershipTransferred) {
				setMembers((current) => current.map((item) => (
					item._id === memberId ? data : item.user?._id === authUserId ? { ...item, role: 'admin' } : item
				)))
				const handedOver = { createdBy: data.boardOwnerId, access: 'invited', role: 'admin' }
				setBoards((current) => current.map((item) => (item._id === boardId ? { ...item, ...handedOver } : item)))
				setSelectedBoard((current) => (current ? { ...current, ...handedOver } : current))
				toast.success(tr('boardHeader.transferred'))
			} else {
				setMembers((current) => current.map((item) => (item._id === memberId ? data : item)))
				toast.success(tr('boardHeader.roleChanged'))
			}
		} catch (error) {
			failToast(error, 'auth.errors.generic')
		}
	}
	const removeMember = async (member) => {
		try {
			await axiosInstance.delete(`/board/boards/${boardId}/members/${member._id}`)
			setMembers((current) => current.filter((record) => record._id !== member._id))
			toast.success(tr('boardHeader.removed', { name: member.user?.name || member.user?.email }))
		} catch (error) {
			failToast(error, 'auth.errors.generic')
		}
	}

	return {
		members,
		setMembers,
		invites,
		setInvites,
		inviteLink,
		setInviteLink,
		publicLink,
		setPublicLink,
		suggestions,
		copyText,
		inviteByEmail,
		resendInvite,
		copyInviteFor,
		cancelInvite,
		createInviteLink,
		turnOffInviteLink,
		createViewLink,
		turnOffViewLink,
		changeMemberRole,
		removeMember,
	}
}

export default useBoardSharing
