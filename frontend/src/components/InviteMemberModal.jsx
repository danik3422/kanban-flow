import {
	CheckCircle2,
	ChevronDown,
	Clock3,
	Link2,
	Mail,
	UserRound,
	UsersRound,
	X,
} from 'lucide-react'
import { useState } from 'react'
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
	publicLink = '',
	onCreatePublicLink,
	isOpen,
	onChange,
	onClose,
	onSubmit,
	onRevoke,
	onCopyInvite,
	onRoleChange,
}) => {
	const [mode, setMode] = useState('email')
	const [role, setRole] = useState('member')
	const [tab, setTab] = useState('members')
	const [openRoleMemberId, setOpenRoleMemberId] = useState(null)
	const [membersPage, setMembersPage] = useState(1)
	const [invitesPage, setInvitesPage] = useState(1)
	const pageSize = 5
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
						<div className='share-link-box'>
							<span className='share-link-icon'>
								<Link2 size={18} />
							</span>
							<div>
								<strong>Anyone with this link can join the board</strong>
								<small>Share it anywhere · expires in 7 days</small>
							</div>
							<button
								type='button'
								className='quiet-button'
								onClick={() => onSubmit({ preventDefault: () => {} }, 'link')}
							>
								<Link2 size={14} /> Copy
							</button>
						</div>
					</>
				)}
				{roomVisibility === 'public' && canManageMembers && (
					<div className='public-link-panel'>
						<div><strong>Public view link</strong><small>Share this link to let people view without joining.</small></div>
						<button type='button' className='quiet-button' onClick={onCreatePublicLink}>{publicLink ? 'Copy link again' : 'Create link'}</button>
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
												{['member', 'admin', ...(canTransferOwnership ? ['owner'] : [])].map((role) => (
													<button
														type='button'
														role='menuitem'
														className={role === currentRole ? 'active' : ''}
														onClick={() => {
															setOpenRoleMemberId(null)
															onRoleChange(member._id, role)
														}}
													>
														{role.replace(/^./, (letter) => letter.toUpperCase())}
													</button>
												))}
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
										<small>
											<span className={`invite-source-label ${invite.email ? 'is-email' : 'is-link'}`}>
												{invite.email ? 'Email invitation' : 'Link invitation'}
											</span>{' '}
											{invite.email ? invite.email : 'Anyone who has the invite link'} · Sent{' '}
											{new Date(invite.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
										</small>
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
										{invite.status === 'pending' && (
											<>
												<button
													type='button'
													className='board-invite-copy'
													onClick={() => onCopyInvite(invite._id)}
												>
													Copy link
												</button>
												<button
													type='button'
													className='board-invite-revoke'
													onClick={() => onRevoke(invite._id)}
												>
													Cancel
												</button>
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
