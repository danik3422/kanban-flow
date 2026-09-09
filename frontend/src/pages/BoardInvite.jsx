import {
	AlertTriangle,
	ArrowLeft,
	ArrowRight,
	CheckCircle2,
	Link2,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { axiosInstance } from '../lib/axios'
import { useAuthStore } from '../store/useAuthStore'

const BoardInvite = () => {
	const { token } = useParams()
	const navigate = useNavigate()
	const [searchParams] = useSearchParams()
	const authUser = useAuthStore((state) => state.authUser)
	const [error, setError] = useState(searchParams.get('error') || '')
	const [boardName, setBoardName] = useState('this board')
	const normalizedError = error.toLowerCase()
	const isSelfInviteError = normalizedError.includes('yourself')
	const isExpiredInviteError =
		!isSelfInviteError &&
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
				const message =
					requestError.response?.data?.message ||
					'This invite is no longer available'
				setError(message)
			})
	}, [token])

	useEffect(() => {
		if (!authUser) {
			localStorage.setItem('kanban-pending-invite', token)
			return
		}
		axiosInstance
			.post(`/board/invites/${token}/accept`)
			.then(({ data }) => {
				localStorage.removeItem('kanban-pending-invite')
				navigate(`/workspaces/${data.boardId}`, { replace: true })
			})
			.catch((requestError) =>
				setError(
					requestError.response?.data?.message ||
						'This invite is no longer available',
				),
			)
	}, [authUser, navigate, token])

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
							: isExpiredInviteError
								? 'Invite expired'
								: 'Invitation unavailable'
						: 'Shared board invite'}
				</p>
				<h1>
					{error
						? (isSelfInviteError
							? 'You can’t invite yourself.'
							: isExpiredInviteError
								? 'This invitation has expired.'
								: 'This invite can’t be used.')
						: `You’re invited to join ${boardName}.`}
				</h1>
				{error ? (
					<>
						<div className='invite-error-message'>
							<strong>
								{isSelfInviteError
									? 'Sorry, you can’t invite yourself to a board you already own.'
									: isExpiredInviteError
										? 'Invite expired'
										: error}
							</strong>
							<p>
								{isSelfInviteError
									? 'This link was created from your own workspace, so it can’t be used to add yourself again.'
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
