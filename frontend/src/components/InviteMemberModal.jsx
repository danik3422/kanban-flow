import {
	CheckCircle2,
	ChevronDown,
	Clock3,
	Copy,
	Link2,
	Mail,
	Crown,
	ShieldCheck,
	UserRound,
	UserMinus,
	UsersRound,
	X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import Popover from './Popover'

const InviteMemberModal = ({
	email,
	members = [],
	invites = [],
	currentUserId,
	boardOwnerId,
	presenceByUserId = {},
	canManageMembers = false,
	showPresence = false,
	roomVisibility = 'private',
	inviteLink = null,
	publicLink = '',
	onCreatePublicLink,
	onRevokePublicLink,
	onRevokeInviteLink,
	isOpen,
	onChange,
	onClose,
	onSubmit,
	onRoleChange,
	onRemoveMember,
}) => {
	const [mode, setMode] = useState('email')
	const [role, setRole] = useState('member')
	const [linkRole, setLinkRole] = useState('member')
	const [tab, setTab] = useState('members')
	const [openRoleMemberId, setOpenRoleMemberId] = useState(null)
	const [membersPage, setMembersPage] = useState(1)
	const [invitesPage, setInvitesPage] = useState(1)
	const [isRevokeConfirmOpen, setIsRevokeConfirmOpen] = useState(false)
	const [isInviteRevokeConfirmOpen, setIsInviteRevokeConfirmOpen] = useState(false)
	const pageSize = 5
	useEffect(() => {
		if (!openRoleMemberId) return undefined

		const closeOnOutsideInteraction = (event) => {
			if (!event.target.closest('.share-role-menu')) {
				setOpenRoleMemberId(null)
			}
		}
		const closeOnEscape = (event) => {
			if (event.key === 'Escape') setOpenRoleMemberId(null)
		}

		document.addEventListener('mousedown', closeOnOutsideInteraction)
		document.addEventListener('keydown', closeOnEscape)
		return () => {
			document.removeEventListener('mousedown', closeOnOutsideInteraction)
			document.removeEventListener('keydown', closeOnEscape)
		}
	}, [openRoleMemberId])
	const onlineCount = showPresence
		? Object.values(presenceByUserId).filter((status) => status === 'online').length
		: 0
	const membersPageCount = Math.max(1, Math.ceil(members.length / pageSize))
	const invitesPageCount = Math.max(1, Math.ceil(invites.length / pageSize))
	const safeMembersPage = Math.min(membersPage, membersPageCount)
	const safeInvitesPage = Math.min(invitesPage, invitesPageCount)
	const visibleMembers = members.slice(
		(safeMembersPage - 1) * pageSize,
		safeMembersPage * pageSize,
	)
	const visibleInvites = invites.slice(
		(safeInvitesPage - 1) * pageSize,
		safeInvitesPage * pageSize,
	)
	const roomDescription = roomVisibility === 'public'
		? 'Anyone can discover this room. Members can collaborate here.'
		: roomVisibility === 'workspace'
			? 'Workspace members can view this room. Members can collaborate here.'
			: 'Only invited members can view and edit this room.'

	const renderPagination = (page, pageCount, setPage) => {
		if (pageCount <= 1) return null
		return (
			<nav className='share-pagination' aria-label='Pagination'>
				<button
					type='button'
					className='share-pagination-button'
					disabled={page === 1}
					onClick={() => setPage((current) => current - 1)}
				>
					Previous
				</button>
				<span>
					Page {page} of {pageCount}
				</span>
				<button
					type='button'
					className='share-pagination-button'
					disabled={page === pageCount}
					onClick={() => setPage((current) => current + 1)}
				>
					Next
				</button>
			</nav>
		)
	}

	if (!isOpen) return null

	return (
		<Popover isOpen={isOpen} onClose={onClose} className='modal-backdrop' onMouseDown={onClose}>
			<form
				className='modal-panel share-board-modal'
				onSubmit={(event) => onSubmit(event, mode, role)}
				onMouseDown={(event) => event.stopPropagation()}
			>
				<div className='modal-title share-header'>
					<span className='share-header-icon'>
						<UsersRound size={20} />
					</span>
					<div className='share-header-copy'>
						<span className='share-kicker'>Collaborate</span>
						<h2>{canManageMembers ? 'Invite people' : 'People in this room'}</h2>
						<p>{canManageMembers ? 'Bring the right people into this room.' : roomDescription}</p>
					</div>
					{showPresence && (
						<span className='share-online-count'>
							<span className='share-online-dot' />{' '}
							{onlineCount} online
						</span>
					)}
					<button
						type='button'
						className='icon-button'
						onClick={onClose}
						aria-label='Close'
						title='Close'
					>
						<X size={18} />
					</button>
				</div>
				{canManageMembers && (
					<>
						<div className='share-section-heading'>
							<div>
								<strong>Invite someone</strong>
								<span>Send a direct invitation by email.</span>
							</div>
						</div>
						<div className='share-invite-row'>
							<div className='share-email-wrap'>
								<Mail size={17} />
								<input
									id='invite-email'
									type='email'
									autoFocus={mode === 'email'}
									value={email}
									onChange={onChange}
									placeholder='Email address or name'
								/>
							</div>
							<select
								className='share-role'
								aria-label='Member role'
								value={role}
								onChange={(event) => setRole(event.target.value)}
							>
								<option value='member'>Member</option>
								<option value='admin'>Admin</option>
							</select>
							<button
								className='primary-button share-submit'
								type='submit'
								onClick={() => setMode('email')}
							>
								<Mail size={16} /> Share
							</button>
						</div>
						<div className='public-link-panel invite-link-panel'>
							<div className='public-link-heading'>
								<span className='public-link-heading-icon'><Link2 size={18} /></span>
								<div>
									<div className='public-link-title-row'>
										<strong>Invite link</strong>
										<span className={`public-link-status ${inviteLink ? 'is-active' : 'is-ready'}`}>
											{inviteLink ? 'Active' : 'Not created'}
										</span>
									</div>
									<small>One person can accept this link and join the room.</small>
								</div>
							</div>
							{inviteLink ? (
								<>
									<div className='invite-link-meta'>
										<span className='invite-link-meta-label'>Role</span>
										<strong>{inviteLink.role === 'admin' ? 'Admin access' : 'Member access'}</strong>
									</div>
									<div className='public-link-field'>
										<input value={inviteLink.inviteUrl} readOnly aria-label='Invite link' />
										<button
											type='button'
											className='public-link-copy-button'
											onClick={() => navigator.clipboard?.writeText?.(inviteLink.inviteUrl)}
											aria-label='Copy invite link'
											title='Copy invite link'
										>
											<Copy size={16} />
										</button>
									</div>
									{isInviteRevokeConfirmOpen ? (
										<div className='public-link-revoke-confirm invite-link-revoke-confirm'>
											<span>This immediately disables the invite link.</span>
											<div>
												<button type='button' className='quiet-button' onClick={() => setIsInviteRevokeConfirmOpen(false)}>Keep link</button>
												<button type='button' className='quiet-button danger' onClick={() => { setIsInviteRevokeConfirmOpen(false); onRevokeInviteLink() }}>Revoke link</button>
											</div>
										</div>
									) : (
										<button type='button' className='public-link-revoke invite-link-revoke' onClick={() => setIsInviteRevokeConfirmOpen(true)}>Revoke current invite link</button>
									)}
								</>
							) : (
								<div className='invite-link-controls'>
									<label htmlFor='invite-link-role'>Role</label>
									<select
										id='invite-link-role'
										className='share-role invite-link-role'
										value={linkRole}
										onChange={(event) => setLinkRole(event.target.value)}
									>
										<option value='member'>Member</option>
										<option value='admin'>Admin</option>
									</select>
									<button
										type='button'
										className='primary-button public-link-create'
										onClick={() => onSubmit({ preventDefault: () => {} }, 'link', linkRole)}
									>
										<Link2 size={15} /> Create link
									</button>
								</div>
							)}
						</div>
					</>
				)}
				{roomVisibility === 'public' && canManageMembers && (
					<div className='public-link-panel'>
						<div className='public-link-heading'>
							<span className='public-link-heading-icon'><ShieldCheck size={18} /></span>
							<div>
								<div className='public-link-title-row'>
									<strong>Public view link</strong>
									<span className={`public-link-status ${publicLink ? 'is-active' : 'is-ready'}`}>
										{publicLink ? 'Active' : 'Not created'}
									</span>
								</div>
								<small>Anyone with the link can view this room without joining.</small>
							</div>
						</div>
						{publicLink ? (
							<>
								<div className='public-link-field'>
									<input value={publicLink} readOnly aria-label='Public view link' />
									<button type='button' className='public-link-copy-button' onClick={onCreatePublicLink} aria-label='Copy public view link' title='Copy public view link'>
										<Copy size={16} />
									</button>
								</div>
								{isRevokeConfirmOpen ? (
									<div className='public-link-revoke-confirm'>
										<span>This immediately disables the current link.</span>
										<div>
											<button type='button' className='quiet-button' onClick={() => setIsRevokeConfirmOpen(false)}>Keep link</button>
											<button type='button' className='quiet-button danger' onClick={() => { setIsRevokeConfirmOpen(false); onRevokePublicLink() }}>Revoke link</button>
										</div>
									</div>
								) : (
									<button type='button' className='public-link-revoke' onClick={() => setIsRevokeConfirmOpen(true)}>Revoke current link</button>
								)}
							</>
						) : (
							<div className='public-link-empty'>
								<span>Create one stable link and share it anywhere. You can revoke it whenever access should stop.</span>
								<button type='button' className='primary-button public-link-create' onClick={onCreatePublicLink}><Link2 size={15} /> Create public link</button>
							</div>
						)}
					</div>
				)}
				{canManageMembers && (
					<div className='share-tabs' role='tablist'>
						<button
							type='button'
							className={tab === 'members' ? 'active' : ''}
							onClick={() => setTab('members')}
						>
							Board members <b>{members.length}</b>
						</button>
						<button
							type='button'
							className={tab === 'invites' ? 'active' : ''}
							onClick={() => setTab('invites')}
						>
							Invitations <b>{invites.length}</b>
						</button>
					</div>
				)}
				{!canManageMembers || tab === 'members' ? (
					<div className='share-member-list'>
						{members.length ? (
							visibleMembers.map((member) => (
								<div className='share-member-row' key={member._id}>
									{(() => {
										const memberUserId = member.user?._id || member._id
										const isOwner = String(memberUserId) === String(boardOwnerId)
										const status = presenceByUserId[String(memberUserId)] || 'offline'
										const canTransferOwnership =
											canManageMembers &&
											String(currentUserId) === String(boardOwnerId)
										const currentRole = isOwner ? 'owner' : member.role || 'member'
										const canEditRole =
											canManageMembers &&
											!isOwner &&
											member.user?._id !== currentUserId &&
											member._id !== currentUserId

										return (
											<>
									<span className={`share-member-avatar is-${status}`}>
										<UserRound size={18} />
										<span className='share-member-presence' aria-label={status} />
									</span>
									<div>
										<strong>
											{member.user?.name ||
												member.user?.email ||
												member.name ||
												member.email}
										</strong>
										<small>{member.user?.email || member.email}</small>
									</div>
									<span className={`share-member-status is-${status}`}>
										<span className='share-member-status-dot' />
										{status[0].toUpperCase() + status.slice(1)}
									</span>
									<div className='share-role-menu'>
										<button
											type='button'
											className={`share-member-role-select ${!canEditRole ? 'is-disabled' : ''}`}
											disabled={!canEditRole}
											onClick={() => setOpenRoleMemberId((current) => current === member._id ? null : member._id)}
											aria-haspopup='menu'
											aria-expanded={openRoleMemberId === member._id}
										>
											{currentRole.replace(/^./, (letter) => letter.toUpperCase())}
											<ChevronDown size={14} />
										</button>
										{openRoleMemberId === member._id && canEditRole && (
											<div className='share-role-menu-list' role='menu'>
												<div className='share-role-menu-heading'>Access level</div>
												{['member', 'admin', ...(canTransferOwnership ? ['owner'] : [])].map((role) => (
													<button
														type='button'
														role='menuitem'
														className={`share-role-option ${role === currentRole ? 'active' : ''}`}
														onClick={() => {
															setOpenRoleMemberId(null)
															onRoleChange(member._id, role)
														}}
													>
														{role === 'owner' ? <Crown size={14} /> : role === 'admin' ? <ShieldCheck size={14} /> : <UserRound size={14} />}
														<span>{role.replace(/^./, (letter) => letter.toUpperCase())}</span>
													</button>
												))}
														{canTransferOwnership && (
															<button
																type='button'
																role='menuitem'
																className='share-role-option is-danger'
																onClick={() => {
																	setOpenRoleMemberId(null)
																	onRemoveMember(member._id)
																}}
															>
																<UserMinus size={14} />
																<span>Remove from room</span>
															</button>
														)}
											</div>
										)}
									</div>
											</>
									)
								})()}
								</div>
							))
						) : (
							<p className='share-empty'>No members yet.</p>
						)}
						{renderPagination(membersPage, membersPageCount, setMembersPage)}
					</div>
				) : (
					<div className='share-member-list share-invite-list'>
						{invites.length ? (
							visibleInvites.map((invite) => (
								<div className='share-member-row share-invite-row-item' key={invite._id}>
									<span className={`share-member-avatar invite-source-avatar ${invite.email ? 'is-email' : 'is-link'}`}>
										{invite.email ? <Mail size={18} /> : <Link2 size={18} />}
									</span>
									<div>
										<strong>{invite.email || 'Anyone with the link'}</strong>
										<small className='invite-meta-line'>
											<span className={`invite-source-label ${invite.email ? 'is-email' : 'is-link'}`}>
												{invite.email ? 'Email invitation' : 'Link invitation'}
											</span>{' '}
											{invite.email ? invite.email : 'Anyone who has the invite link'} · Sent{' '}
											{new Date(invite.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
										</small>
										<small className='invite-history-line'>
											Created by {invite.createdBy?.name || invite.createdBy?.email || 'Board admin'} ·{' '}
											{invite.role === 'admin' ? 'Admin' : 'Member'} access
										</small>
										{invite.acceptedBy && (
											<small className='invite-history-line is-accepted'>
												Joined by {invite.acceptedBy.name || invite.acceptedBy.email}
											</small>
										)}
									</div>
									<span className={`board-invite-status ${invite.status}`}>
										{invite.status === 'accepted' ? (
											<>
												<CheckCircle2 size={13} /> Accepted
											</>
										) : invite.status === 'expired' ? (
											'Expired'
										) : (
											<>
												<Clock3 size={13} /> Pending
											</>
										)}
									</span>
								</div>
							))
						) : (
							<p className='share-empty'>No invitations yet.</p>
						)}
						{renderPagination(invitesPage, invitesPageCount, setInvitesPage)}
					</div>
				)}
			</form>
		</Popover>
	)
}

export default InviteMemberModal
