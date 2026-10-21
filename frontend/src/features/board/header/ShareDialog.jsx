import { ChevronDown, Copy, Crown, Globe2, Link2, LogOut, MailPlus, MoreHorizontal, RotateCw, Search, Send, ShieldCheck, UserMinus, UserRound, X } from 'lucide-react'
import { useState } from 'react'
import { useI18n } from '../../../i18n'
import { intlLocale } from '../../../i18n/translate'
import { Avatar, Badge, Button, ConfirmDialog, IconButton, Input, Menu, Modal, SegmentedControl } from '../../../ui'
import { relativeTime } from '../../../lib/relativeTime'
import EmailChips, { EMAIL } from './EmailChips'

const ROLE_ICONS = { member: UserRound, admin: ShieldCheck, owner: Crown }

/** A role picker as a small button: the current role, a menu of the others with what they mean. */
const RoleButton = ({ value, onChange, label, includeOwner, extraItems = [] }) => {
	const { t } = useI18n()
	return (
		<Menu
			label={label}
			trigger={(props) => (
				<button type='button' className='bh-role-button' {...props} aria-label={`${label}: ${t(`boardHeader.roles.${value}`)}`}>
					<span>{t(`boardHeader.roles.${value}`)}</span>
					<ChevronDown size={14} aria-hidden='true' />
				</button>
			)}
			items={[
				...['member', 'admin', ...(includeOwner ? ['owner'] : [])].map((role) => ({
					label: `${t(`boardHeader.roles.${role}`)} — ${t(`boardHeader.roleHints.${role}`)}`,
					icon: ROLE_ICONS[role],
					checked: role === value,
					mark: 'end',
					onSelect: () => role !== value && onChange(role),
				})),
				...extraItems,
			]}
		/>
	)
}

/**
 * Share a board: invite several people at once (with suggestions from your other
 * boards), an invite link and the public view link, then everyone on the board
 * and the open invitations, each with their own actions. Plain members see who is
 * here and can leave.
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
	suggestions,
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
	onResendInvite,
	onCopyInvite,
	onLeave,
}) => {
	const { t, language } = useI18n()
	const [emails, setEmails] = useState([])
	const [role, setRole] = useState('member')
	const [error, setError] = useState('')
	const [busy, setBusy] = useState(false)
	const [tab, setTab] = useState('members')
	const [query, setQuery] = useState('')
	const [confirm, setConfirm] = useState(null) // { kind: 'remove' | 'transfer', member }
	const [wasOpen, setWasOpen] = useState(open)
	if (wasOpen !== open) {
		setWasOpen(open)
		if (open) {
			setEmails([])
			setError('')
			setTab('members')
			setQuery('')
		}
	}

	const ownerId = String(board?.createdBy?._id || board?.createdBy || '')
	const pending = (invites || []).filter((invite) => invite.email && invite.status !== 'accepted')
	const roleOf = (member) => (String(member.user?._id) === ownerId ? 'owner' : member.role || 'member')
	const nameOf = (member) => member.user?.name || member.user?.email || ''
	const rank = { owner: 0, admin: 1, member: 2 }
	const needle = query.trim().toLowerCase()
	const people = [...(members || [])]
		.filter((member) => !needle || [member.user?.name, member.user?.email].some((value) => value?.toLowerCase().includes(needle)))
		.sort((a, b) => rank[roleOf(a)] - rank[roleOf(b)] || nameOf(a).localeCompare(nameOf(b)))
	const taken = [...(members || []).map((member) => member.user?.email), ...pending.map((invite) => invite.email)].filter(Boolean).map((email) => email.toLowerCase())
	const formatDate = (value) => new Intl.DateTimeFormat(intlLocale(language), { day: 'numeric', month: 'short' }).format(new Date(value))
	const invalid = emails.filter((email) => !EMAIL.test(email))

	const submit = async (event) => {
		event.preventDefault()
		if (!emails.length) {
			setError(t('boardHeader.emailInvalid'))
			return
		}
		if (invalid.length) {
			setError(`${t('boardHeader.emailInvalid')}: ${invalid.join(', ')}`)
			return
		}
		setBusy(true)
		const failed = await onInvite(emails, role)
		setBusy(false)
		setEmails(failed)
		if (!failed.length) setTab('invites')
	}

	const runConfirm = async () => {
		if (!confirm) return
		setBusy(true)
		if (confirm.kind === 'remove') await onRemove(confirm.member)
		else await onRoleChange(confirm.member, 'owner')
		setBusy(false)
		setConfirm(null)
	}

	return (
		<>
			<Modal open={open} onClose={onClose} title={t('boardHeader.shareTitle')} description={board?.name} size='md' className='bh-share-modal'>
				<div className='bh-share-body'>
					{canManage ? (
						<form className='bh-invite' onSubmit={submit} noValidate>
							<EmailChips
								emails={emails}
								onChange={(next) => {
									setEmails(next)
									setError('')
								}}
								suggestions={suggestions}
								excluded={taken}
								disabled={busy}
								invalid={Boolean(error)}
							/>
							<div className='bh-invite__row'>
								<RoleButton value={role} onChange={setRole} label={t('boardHeader.role')} />
								<Button type='submit' icon={Send} loading={busy && !confirm} disabled={!emails.length}>
									{emails.length > 1 ? t('boardHeader.inviteCount', { count: emails.length }) : t('boardHeader.invite')}
								</Button>
							</div>
							{error ? <p className='bh-invite__error' role='alert'>{error}</p> : <p className='bh-muted bh-invite__hint'>{t(`boardHeader.roleHints.${role}`)}</p>}
						</form>
					) : (
						<p className='bh-note'>{t('boardHeader.onlyAdmins')}</p>
					)}

					{canManage && (
						<section className='bh-link-card' aria-label={t('boardHeader.linkTitle')}>
							<div className='bh-link-card__head'>
								<span className='bh-link-card__icon' aria-hidden='true'><Link2 size={18} /></span>
								<span className='bh-link-card__text'>
									<span className='bh-link-card__title'>{t('boardHeader.linkTitle')}</span>
									<span className='bh-muted'>{inviteLink?.expiresAt ? t('boardHeader.linkUntil', { date: formatDate(inviteLink.expiresAt) }) : t('boardHeader.linkText')}</span>
								</span>
								{inviteLink?.inviteUrl
									? <Button variant='ghost' size='sm' className='bh-danger-text' onClick={onRevokeInviteLink}>{t('boardHeader.revokeLink')}</Button>
									: <Button variant='secondary' size='sm' onClick={onCreateInviteLink}>{t('boardHeader.createLink')}</Button>}
							</div>
							{inviteLink?.inviteUrl && (
								<div className='bh-link-card__url'>
									<Input readOnly value={inviteLink.inviteUrl} aria-label={t('boardHeader.linkUrlLabel')} onFocus={(event) => event.target.select()} />
									<Button variant='secondary' icon={Copy} onClick={() => onCopy(inviteLink.inviteUrl, t('boardHeader.linkCopied'))}>{t('boardHeader.copyInvite')}</Button>
								</div>
							)}
						</section>
					)}

					{canManage && board?.visibility === 'public' && (
						<section className='bh-link-card' aria-label={t('boardHeader.publicTitle')}>
							<div className='bh-link-card__head'>
								<span className='bh-link-card__icon' aria-hidden='true'><Globe2 size={18} /></span>
								<span className='bh-link-card__text'>
									<span className='bh-link-card__title'>{t('boardHeader.publicTitle')}</span>
									<span className='bh-muted'>{t('boardHeader.publicText')}</span>
								</span>
								{publicLink
									? <Button variant='ghost' size='sm' className='bh-danger-text' onClick={onRevokePublicLink}>{t('boardHeader.revokeLink')}</Button>
									: <Button variant='secondary' size='sm' onClick={onCreatePublicLink}>{t('boardHeader.publicCreate')}</Button>}
							</div>
							{publicLink && (
								<div className='bh-link-card__url'>
									<Input readOnly value={publicLink} aria-label={t('boardHeader.publicTitle')} onFocus={(event) => event.target.select()} />
									<Button variant='secondary' icon={Copy} onClick={() => onCopy(publicLink, t('boardHeader.publicCopied'))}>{t('boardHeader.copyInvite')}</Button>
								</div>
							)}
						</section>
					)}

					<section className='bh-people-section'>
						<div className='bh-people-head'>
							{canManage ? (
								<SegmentedControl
									label={t('boardHeader.people')}
									value={tab}
									onChange={setTab}
									options={[
										{ value: 'members', label: <>{t('boardHeader.membersTab')}<span className='ui-segmented__count'>{members?.length || 0}</span></> },
										{ value: 'invites', label: <>{t('boardHeader.invitesTab')}<span className='ui-segmented__count'>{pending.length}</span></> },
									]}
								/>
							) : (
								<h3 className='bh-section-title'>{t('boardHeader.peopleTitle', { count: members?.length || 0 })}</h3>
							)}
							{tab === 'members' && (members?.length || 0) > 5 && (
								<Input className='bh-people-search' icon={Search} type='search' value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('boardHeader.searchPeople')} aria-label={t('boardHeader.searchPeople')} />
							)}
						</div>

						{tab === 'members' && (
							people.length ? (
								<ul className='bh-people-list'>
									{people.map((member) => {
										const memberRole = roleOf(member)
										const isMe = String(member.user?._id) === String(currentUserId)
										const editable = canManage && !isMe && memberRole !== 'owner'
										return (
											<li key={member._id} className='bh-person'>
												<Avatar name={nameOf(member)} src={member.user?.avatar} size={38} status={presence?.[member.user?._id] === 'online' ? 'online' : undefined} />
												<span className='bh-person__text'>
													<span className='bh-person__name' data-i18n-ignore>
														{nameOf(member)}
														{isMe && <span className='bh-muted'> · {t('boardHeader.you')}</span>}
													</span>
													<span className='bh-muted' data-i18n-ignore>{member.user?.email}</span>
												</span>
												{editable ? (
													<RoleButton
														value={memberRole}
														label={t('boardHeader.memberActions', { name: nameOf(member) })}
														includeOwner={isOwner}
														onChange={(next) => (next === 'owner' ? setConfirm({ kind: 'transfer', member }) : onRoleChange(member, next))}
														extraItems={[{ separator: true }, { label: t('boardHeader.remove'), icon: UserMinus, tone: 'danger', onSelect: () => setConfirm({ kind: 'remove', member }) }]}
													/>
												) : isMe && memberRole !== 'owner' ? (
													<Menu
														label={t('boardHeader.memberActions', { name: nameOf(member) })}
														trigger={(props) => (
															<button type='button' className='bh-role-button' {...props} aria-label={`${t('boardHeader.memberActions', { name: nameOf(member) })}: ${t(`boardHeader.roles.${memberRole}`)}`}>
																<span>{t(`boardHeader.roles.${memberRole}`)}</span>
																<ChevronDown size={14} aria-hidden='true' />
															</button>
														)}
														items={[{ label: t('boardHeader.leaveSelf'), icon: LogOut, tone: 'danger', onSelect: onLeave }]}
													/>
												) : (
													<Badge tone={memberRole === 'owner' ? 'accent' : 'neutral'}>{t(`boardHeader.roles.${memberRole}`)}</Badge>
												)}
											</li>
										)
									})}
								</ul>
							) : (
								<p className='bh-muted bh-empty'>{t('boardHeader.noPeopleFound', { query: query.trim() })}</p>
							)
						)}

						{tab === 'invites' && (
							pending.length ? (
								<ul className='bh-people-list'>
									{pending.map((invite) => {
										const expired = invite.status === 'expired' || (invite.expiresAt && new Date(invite.expiresAt) <= new Date())
										return (
											<li key={invite._id} className='bh-person'>
												<span className='bh-invite-avatar' aria-hidden='true'><MailPlus size={17} /></span>
												<span className='bh-person__text'>
													<span className='bh-person__name' data-i18n-ignore>{invite.email}</span>
													<span className='bh-muted'>
														{t(`boardHeader.roles.${invite.role || 'member'}`)}
														{' · '}
														{t('boardHeader.sentAgo', { time: relativeTime(invite.createdAt, language, t('boards.justNow')) })}
														{' · '}
														{expired ? <span className='bh-danger-text'>{t('boardHeader.expired')}</span> : t('boardHeader.until', { date: formatDate(invite.expiresAt) })}
													</span>
												</span>
												<Menu
													label={t('boardHeader.inviteActions', { email: invite.email })}
													trigger={(props) => <IconButton icon={MoreHorizontal} size='sm' label={t('boardHeader.inviteActions', { email: invite.email })} {...props} />}
													items={[
														{ label: t('boardHeader.resend'), icon: RotateCw, onSelect: () => onResendInvite(invite) },
														...(expired ? [] : [{ label: t('boardHeader.copyInviteLink'), icon: Copy, onSelect: () => onCopyInvite(invite) }]),
														{ separator: true },
														{ label: t('boardHeader.revokeInvite'), icon: X, tone: 'danger', onSelect: () => onRevokeInvite(invite) },
													]}
												/>
											</li>
										)
									})}
								</ul>
							) : (
								<p className='bh-muted bh-empty'>{t('boardHeader.noInvites')}</p>
							)
						)}
					</section>
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
