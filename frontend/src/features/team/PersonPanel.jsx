import { ChevronRight, Copy, Mail, Send, UserMinus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../../i18n'
import { translateServerMessageCurrent } from '../../i18n/translate'
import { axiosInstance } from '../../lib/axios'
import { Avatar, Badge, Button, ConfirmDialog, IconButton, Modal, Select } from '../../ui'
import { boardToneFor } from '../boards/boardTone'

/**
 * One person: how to reach them, how loaded they are on the boards we share,
 * their role on each (editable where I manage the board) and inviting them to more.
 */
const PersonPanel = ({ person, isMe, managedBoards, onClose, onCopyEmail, onChanged, onInvite }) => {
	const { t } = useI18n()
	const [removeTarget, setRemoveTarget] = useState(null)
	const [isRemoving, setIsRemoving] = useState(false)
	const [roles, setRoles] = useState({})
	const [inviteBoardId, setInviteBoardId] = useState('')
	const [isInviting, setIsInviting] = useState(false)

	if (!person) return null
	const name = person.name || person.email
	const canInviteTo = managedBoards.filter((board) => !person.memberships.some((membership) => membership.boardId === board._id))
	const selectedInviteBoard = canInviteTo.some((board) => board._id === inviteBoardId) ? inviteBoardId : canInviteTo[0]?._id || ''

	const changeRole = async (membership, role) => {
		setRoles((current) => ({ ...current, [membership.memberId]: role }))
		try {
			await axiosInstance.patch(`/board/boards/${membership.boardId}/members/${membership.memberId}`, { role })
			onChanged({ message: t('team.roleChanged') })
		} catch (error) {
			setRoles((current) => ({ ...current, [membership.memberId]: membership.role }))
			onChanged({ error: translateServerMessageCurrent(error.response?.data?.message, 'team.roleError') })
		}
	}

	const remove = async () => {
		if (!removeTarget) return
		setIsRemoving(true)
		try {
			await axiosInstance.delete(`/board/boards/${removeTarget.boardId}/members/${removeTarget.memberId}`)
			onChanged({ message: t('team.removed'), reload: true })
			setRemoveTarget(null)
		} catch (error) {
			onChanged({ error: translateServerMessageCurrent(error.response?.data?.message, 'team.removeError') })
		} finally {
			setIsRemoving(false)
		}
	}

	const invite = async () => {
		if (!selectedInviteBoard || isInviting) return
		setIsInviting(true)
		await onInvite(selectedInviteBoard)
		setIsInviting(false)
	}

	const workload = person.overdue > 0
		? t('team.workloadLine', { open: t('team.open', { count: person.open }), overdue: t('team.overdue', { count: person.overdue }) })
		: t('team.workloadOpenOnly', { open: t('team.open', { count: person.open }) })

	return (
		<>
			<Modal open={Boolean(person) && !removeTarget} onClose={onClose} variant='panel' title={name} className='tm-panel'>
				<div className='tm-panel__intro' data-i18n-ignore>
					<Avatar name={name} src={person.avatar} size={56} decorative />
					<div className='tm-panel__who'>
						{isMe && <Badge tone='accent'>{t('team.you')}</Badge>}
						<span className='tm-panel__email'>{person.email}</span>
					</div>
				</div>
				<div className='tm-panel__actions'>
					<Button as='a' href={`mailto:${person.email}`} variant='secondary' size='sm' icon={Mail}>{t('team.writeEmail')}</Button>
					<Button variant='secondary' size='sm' icon={Copy} onClick={() => onCopyEmail(person.email)}>{t('team.copyEmail')}</Button>
				</div>
				<p className='tm-panel__workload'>{workload}</p>

				<h3 className='tm-panel__section'>{t('team.sharedBoards')}</h3>
				<ul className='tm-panel__boards'>
					{person.memberships.map((membership) => {
						const role = roles[membership.memberId] || membership.role
						const editable = membership.canManage && membership.role !== 'owner' && !isMe
						return (
							<li key={membership.boardId} className='tm-board'>
								<i className='tm-board__swatch' style={{ background: `var(--ui-${boardToneFor(membership.boardId)}-soft-text)` }} aria-hidden='true' />
								<span className='tm-board__text'>
									<span className='tm-board__name' data-i18n-ignore>{membership.boardName}</span>
									<span className='tm-board__load'>
										{membership.open ? t('team.open', { count: membership.open }) : t('team.nothingOpen')}
										{membership.overdue > 0 && <Badge tone='danger'>{t('team.overdue', { count: membership.overdue })}</Badge>}
									</span>
								</span>
								{editable ? (
									<Select
										className='tm-board__role'
										aria-label={t('team.roleOn', { board: membership.boardName })}
										value={role}
										onChange={(event) => changeRole(membership, event.target.value)}
										options={['member', 'admin'].map((value) => ({ value, label: t(`team.role.${value}`) }))}
									/>
								) : (
									<Badge tone={role === 'owner' ? 'accent' : role === 'admin' ? 'info' : 'neutral'}>{t(`team.role.${role}`)}</Badge>
								)}
								{editable && (
									<IconButton icon={UserMinus} size='sm' label={t('team.removeFrom', { board: membership.boardName })} onClick={() => setRemoveTarget({ ...membership, name })} />
								)}
								<IconButton as={Link} to={`/workspaces/${membership.boardId}`} icon={ChevronRight} size='sm' label={t('team.openBoard', { board: membership.boardName })} />
							</li>
						)
					})}
				</ul>

				{!isMe && canInviteTo.length > 0 && (
					<div className='tm-panel__invite'>
						<h3 className='tm-panel__section'>{t('team.addTitle')}</h3>
						<div className='tm-panel__invite-row'>
							<Select aria-label={t('team.addBoard')} value={selectedInviteBoard} onChange={(event) => setInviteBoardId(event.target.value)} options={canInviteTo.map((board) => ({ value: board._id, label: board.name }))} />
							<Button icon={Send} onClick={invite} loading={isInviting}>{t('team.sendInvite')}</Button>
						</div>
					</div>
				)}
			</Modal>
			<ConfirmDialog
				open={Boolean(removeTarget)}
				onClose={() => setRemoveTarget(null)}
				onConfirm={remove}
				loading={isRemoving}
				title={removeTarget ? t('team.removeTitle', { name: removeTarget.name, board: removeTarget.boardName }) : ''}
				description={t('team.removeText')}
				confirmLabel={t('team.remove')}
			/>
		</>
	)
}

export default PersonPanel
