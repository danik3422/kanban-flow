import { Copy, Globe2, Link2, Mail, Send, UserMinus, X } from 'lucide-react'
import { useState } from 'react'
import { useI18n } from '../../../i18n'
import { Avatar, Badge, Button, ConfirmDialog, IconButton, Input, Modal, Select } from '../../../ui'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Share a board: invite by email with a role, an invite link anyone can join with,
 * the public view link, everyone on the board with their role, and open invitations.
 * Plain members see who is here; admins and the owner manage it.
 */
const ShareDialog = ({
	open,
	onClose,
	board,
	canManage,
	isOwner,
	currentUserId,
	members,
	invites,
	presence,
	inviteLink,
	publicLink,
	onInvite,
	onCreateInviteLink,
	onRevokeInviteLink,
	onCreatePublicLink,
	onRevokePublicLink,
	onCopy,
	onRoleChange,
	onRemove,
	onRevokeInvite,
}) => {
	const { t } = useI18n()
	const [email, setEmail] = useState('')
	const [role, setRole] = useState('member')
	const [error, setError] = useState('')
	const [busy, setBusy] = useState(false)
	const [confirm, setConfirm] = useState(null) // { kind: 'remove' | 'transfer', member }

	const ownerId = String(board?.createdBy?._id || board?.createdBy || '')
	const pending = (invites || []).filter((invite) => invite.email && invite.status === 'pending')
	const roleOf = (member) => (String(member.user?._id) === ownerId ? 'owner' : member.role || 'member')
	const people = [...(members || [])].sort((a, b) => {
		const rank = { owner: 0, admin: 1, member: 2 }
		return rank[roleOf(a)] - rank[roleOf(b)] || (a.user?.name || a.user?.email || '').localeCompare(b.user?.name || b.user?.email || '')
	})
	const roleOptions = (includeOwner) => ['member', 'admin', ...(includeOwner ? ['owner'] : [])].map((value) => ({ value, label: t(`boardHeader.roles.${value}`) }))

	const submit = async (event) => {
		event.preventDefault()
		const value = email.trim()
		if (!EMAIL.test(value)) {
			setError(t('boardHeader.emailInvalid'))
			return
		}
		setBusy(true)
		const ok = await onInvite(value, role)
		setBusy(false)
		if (ok) setEmail('')
	}

	const runConfirm = async () => {
		if (!confirm) return
		setBusy(true)
		if (confirm.kind === 'remove') await onRemove(confirm.member)
		else await onRoleChange(confirm.member, 'owner')
		setBusy(false)
		setConfirm(null)
	}

	const nameOf = (member) => member.user?.name || member.user?.email || ''

	return (
		<>
			<Modal open={open} onClose={onClose} title={t('boardHeader.shareTitle')} size='md' className='bh-share-modal'>
				<div className='bh-share-body'>
					{canManage ? (
						<form className='bh-invite' onSubmit={submit} noValidate>
							<Input
								icon={Mail}
								type='email'
								value={email}
								onChange={(event) => {
									setEmail(event.target.value)
									setError('')
								}}
								placeholder={t('boardHeader.emailPlaceholder')}
								aria-label={t('boardHeader.email')}
								aria-invalid={error ? 'true' : undefined}
								autoComplete='email'
							/>
							<Select className='bh-invite__role' aria-label={t('boardHeader.role')} value={role} onChange={(event) => setRole(event.target.value)} options={roleOptions(false)} />
							<Button type='submit' icon={Send} loading={busy && !confirm}>{t('boardHeader.invite')}</Button>
							{error && <p className='bh-invite__error' role='alert'>{error}</p>}
						</form>
					) : (
						<p className='bh-muted'>{t('boardHeader.onlyAdmins')}</p>
					)}

					{canManage && (
						<section className='bh-link-row' aria-label={t('boardHeader.linkTitle')}>
							<span className='bh-link-row__icon' aria-hidden='true'><Link2 size={18} /></span>
							<span className='bh-link-row__text'>
								<span className='bh-link-row__title'>{t('boardHeader.linkTitle')}</span>
								<span className='bh-muted'>{t('boardHeader.linkText')}</span>
							</span>
							{inviteLink?.inviteUrl ? (
								<span className='bh-link-row__actions'>
									<Button variant='secondary' size='sm' icon={Copy} onClick={() => onCopy(inviteLink.inviteUrl, t('boardHeader.linkCopied'))}>{t('boardHeader.copyInvite')}</Button>
									<Button variant='ghost' size='sm' className='bh-danger-text' onClick={onRevokeInviteLink}>{t('boardHeader.revokeLink')}</Button>
								</span>
							) : (
								<Button variant='secondary' size='sm' onClick={onCreateInviteLink}>{t('boardHeader.createLink')}</Button>
							)}
						</section>
					)}

					{canManage && board?.visibility === 'public' && (
						<section className='bh-link-row' aria-label={t('boardHeader.publicTitle')}>
							<span className='bh-link-row__icon' aria-hidden='true'><Globe2 size={18} /></span>
							<span className='bh-link-row__text'>
								<span className='bh-link-row__title'>{t('boardHeader.publicTitle')}</span>
								<span className='bh-muted'>{t('boardHeader.publicText')}</span>
							</span>
							{publicLink ? (
								<span className='bh-link-row__actions'>
									<Button variant='secondary' size='sm' icon={Copy} onClick={() => onCopy(publicLink, t('boardHeader.publicCopied'))}>{t('boardHeader.copyInvite')}</Button>
									<Button variant='ghost' size='sm' className='bh-danger-text' onClick={onRevokePublicLink}>{t('boardHeader.revokeLink')}</Button>
								</span>
							) : (
								<Button variant='secondary' size='sm' onClick={onCreatePublicLink}>{t('boardHeader.publicCreate')}</Button>
							)}
						</section>
					)}

					<section aria-labelledby='bh-people-title'>
						<h3 className='bh-section-title' id='bh-people-title'>{t('boardHeader.peopleTitle', { count: people.length })}</h3>
						<ul className='bh-people-list'>
							{people.map((member) => {
								const memberRole = roleOf(member)
								const isMe = String(member.user?._id) === String(currentUserId)
								const editable = canManage && !isMe && memberRole !== 'owner'
								return (
									<li key={member._id} className='bh-person'>
										<Avatar name={nameOf(member)} src={member.user?.avatar} size={36} status={presence?.[member.user?._id] === 'online' ? 'online' : undefined} />
										<span className='bh-person__text'>
											<span className='bh-person__name' data-i18n-ignore>
												{nameOf(member)}
												{isMe && <span className='bh-muted'> ({t('boardHeader.you')})</span>}
											</span>
											<span className='bh-muted' data-i18n-ignore>{member.user?.email}</span>
										</span>
										{editable ? (
											<span className='bh-person__actions'>
												<Select
													className='bh-person__role'
													aria-label={t('boardHeader.roleLabel', { name: nameOf(member) })}
													value={memberRole}
													onChange={(event) => {
														const next = event.target.value
														if (next === 'owner') setConfirm({ kind: 'transfer', member })
														else onRoleChange(member, next)
													}}
													options={roleOptions(isOwner)}
												/>
												<IconButton icon={UserMinus} size='sm' label={t('boardHeader.remove')} onClick={() => setConfirm({ kind: 'remove', member })} />
											</span>
										) : (
											<Badge tone={memberRole === 'owner' ? 'accent' : 'neutral'}>{t(`boardHeader.roles.${memberRole}`)}</Badge>
										)}
									</li>
								)
							})}
						</ul>
					</section>

					{canManage && pending.length > 0 && (
						<section aria-labelledby='bh-pending-title'>
							<h3 className='bh-section-title' id='bh-pending-title'>{t('boardHeader.pendingTitle', { count: pending.length })}</h3>
							<ul className='bh-people-list'>
								{pending.map((invite) => (
									<li key={invite._id} className='bh-person'>
										<Avatar name={invite.email} size={36} />
										<span className='bh-person__text'>
											<span className='bh-person__name' data-i18n-ignore>{invite.email}</span>
											<span className='bh-muted'>{t('boardHeader.pending')} · {t(`boardHeader.roles.${invite.role || 'member'}`)}</span>
										</span>
										<IconButton icon={X} size='sm' label={t('boardHeader.revokeInvite')} onClick={() => onRevokeInvite(invite)} />
									</li>
								))}
							</ul>
						</section>
					)}
				</div>
			</Modal>
			<ConfirmDialog
				open={Boolean(confirm)}
				onClose={() => !busy && setConfirm(null)}
				onConfirm={runConfirm}
				loading={busy}
				tone={confirm?.kind === 'remove' ? 'danger' : 'primary'}
				title={confirm ? t(confirm.kind === 'remove' ? 'boardHeader.removeTitle' : 'boardHeader.transferTitle', { name: nameOf(confirm.member) }) : ''}
				description={confirm?.kind === 'remove' ? t('boardHeader.removeText') : t('boardHeader.transferText')}
				confirmLabel={confirm?.kind === 'remove' ? t('boardHeader.remove') : t('boardHeader.transferConfirm')}
				confirmText={confirm?.kind === 'transfer' ? board?.name : undefined}
			/>
		</>
	)
}

export default ShareDialog
