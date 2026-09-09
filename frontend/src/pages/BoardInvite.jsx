import {
	AlertTriangle,
	ArrowLeft,
	ArrowRight,
	CheckCircle2,
	Link2,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { axiosInstance } from '../lib/axios'
import { useAuthStore } from '../store/useAuthStore'

const BoardInvite = () => {
	const { token } = useParams()
	const [searchParams] = useSearchParams()
	const authUser = useAuthStore((state) => state.authUser)
	const [requestError, setRequestError] = useState('')
	const [boardName, setBoardName] = useState('this board')
	const error = searchParams.get('error') || requestError
	const normalizedError = error.toLowerCase()
	const isSelfInviteError = normalizedError.includes('yourself')
	const isAlreadyMemberError = normalizedError.includes('already a member')
	const isExpiredInviteError =
		!isSelfInviteError &&
		!isAlreadyMemberError &&
		/(expired|invalid|already used|no longer available|not found|unavailable)/i.test(
			error,
		)

	useEffect(() => {
		axiosInstance
			.get(`/board/invites/${token}/details`)
			.then(({ data }) => {
				setBoardName(data.boardName || 'this board')
			})
			.catch((requestError) => {
				localStorage.removeItem('kanban-pending-invite')
				const message =
					requestError.response?.data?.message ||
					'This invite is no longer available'
				setRequestError(message)
			})
	}, [token])

	useEffect(() => {
		if (searchParams.get('error')) {
			localStorage.removeItem('kanban-pending-invite')
			return
		}
		localStorage.setItem('kanban-pending-invite', token)
	}, [searchParams, token])

	return (
		<main className='invite-page'>
			<section
				className={`account-page-card invite-card ${error ? 'invite-card-error' : ''}`}
			>
				<div className='invite-icon'>
					{error ? <AlertTriangle size={24} /> : <Link2 size={24} />}
				</div>
				<p className='eyebrow'>
					{error
						? isSelfInviteError
							? 'Link invitation'
							: isAlreadyMemberError
								? 'Already a member'
							: isExpiredInviteError
								? 'Invite expired'
								: 'Invitation unavailable'
						: 'Shared board invite'}
				</p>
				<h1>
					{error
						? isSelfInviteError
							? 'You can’t invite yourself.'
							: isAlreadyMemberError
								? 'You already belong to this board.'
							: isExpiredInviteError
								? 'This invitation has expired.'
								: 'This invite can’t be used.'
						: `You’re invited to join ${boardName}.`}
				</h1>
				{error ? (
					<>
						<div className='invite-error-message'>
							<strong>
								{isSelfInviteError
									? 'Sorry, you can’t invite yourself to a board you already own.'
									: isAlreadyMemberError
										? 'You are already a member of this board.'
									: isExpiredInviteError
										? 'Invite expired'
										: error}
							</strong>
							<p>
								{isSelfInviteError
									? 'This link was created from your own workspace, so it can’t be used to add yourself again.'
										: isAlreadyMemberError
											? 'This invitation cannot be used because you already have access to the board.'
									: isExpiredInviteError
										? 'This invite link is expired, invalid, or has already been used.'
										: 'The link may have expired, already been accepted, or been cancelled by the board owner.'}
							</p>
						</div>
						<div className='invite-actions'>
							{authUser ? (
								<Link className='primary-button' to='/workspaces'>
									<ArrowLeft size={16} /> Back to workspace
								</Link>
							) : (
								<Link className='primary-button' to='/'>
									<ArrowLeft size={16} /> Back home
								</Link>
							)}
						</div>
					</>
				) : authUser ? (
					<>
						<div className='invite-status-row'>
							<CheckCircle2 size={22} />
							<p>Accepting your invitation...</p>
						</div>
					</>
				) : (
					<>
						<p>
							Sign in or create an account to accept this one-time invitation.
						</p>
						<div className='invite-actions'>
							<Link className='primary-button' to='/login'>
								<ArrowLeft size={16} /> Sign in
							</Link>
							<Link className='quiet-button' to='/signup'>
								Create account <ArrowRight size={16} />
							</Link>
						</div>
					</>
				)}
			</section>
		</main>
	)
}

export default BoardInvite
