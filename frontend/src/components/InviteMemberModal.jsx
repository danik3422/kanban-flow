import {
	CheckCircle2,
	Clock3,
	Link2,
	Mail,
	UserRound,
	UsersRound,
	X,
} from 'lucide-react'
import { useState } from 'react'

const InviteMemberModal = ({
	email,
	members = [],
	invites = [],
	currentUserId,
	isOpen,
	onChange,
	onClose,
	onSubmit,
	onRevoke,
	onCopyInvite,
	onRoleChange,
}) => {
	const [mode, setMode] = useState('email')
	const [tab, setTab] = useState('members')
	if (!isOpen) return null

	return (
		<div className='modal-backdrop' onMouseDown={onClose}>
			<form
				className='modal-panel share-board-modal'
				onSubmit={(event) => onSubmit(event, mode)}
				onMouseDown={(event) => event.stopPropagation()}
			>
				<div className='modal-title share-header'>
					<span className='share-header-icon'>
						<UsersRound size={20} />
					</span>
					<div className='share-header-copy'>
						<span className='share-kicker'>Collaborate</span>
						<h2>Invite people</h2>
						<p>Bring the right people into this board.</p>
					</div>
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
						defaultValue='member'
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
				{tab === 'members' ? (
					<div className='share-member-list'>
						{members.length ? (
							members.map((member) => (
								<div className='share-member-row' key={member._id}>
									<span className='share-member-avatar'>
										<UserRound size={18} />
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
									<select
										className='share-member-role-select'
										aria-label={`Role for ${member.user?.name || member.name || member.email}`}
										value={member.role || 'member'}
										disabled={
											member.user?._id === currentUserId ||
											member._id === currentUserId
										}
										onChange={(event) =>
											onRoleChange(member._id, event.target.value)
										}
									>
										<option value='member'>Member</option>
										<option value='admin'>Admin</option>
									</select>
								</div>
							))
						) : (
							<p className='share-empty'>No members yet.</p>
						)}
					</div>
				) : (
					<div className='share-member-list'>
						{invites.length ? (
							invites.map((invite) => (
								<div className='share-member-row' key={invite._id}>
									<span className='share-member-avatar'>
										<Clock3 size={18} />
									</span>
									<div>
										<strong>{invite.email || 'Link invitation'}</strong>
										<small>
											Sent {new Date(invite.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
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
					</div>
				)}
			</form>
		</div>
	)
}

export default InviteMemberModal
