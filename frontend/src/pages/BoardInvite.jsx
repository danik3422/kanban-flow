import { ArrowRight, CheckCircle2, Link2 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { axiosInstance } from '../lib/axios'
import { useAuthStore } from '../store/useAuthStore'

const BoardInvite = () => {
	const { token } = useParams()
	const navigate = useNavigate()
	const authUser = useAuthStore((state) => state.authUser)
	const [error, setError] = useState('')

	useEffect(() => {
		if (!authUser) {
			localStorage.setItem('kanban-pending-invite', token)
			return
		}
		axiosInstance.post(`/board/invites/${token}/accept`).then(({ data }) => {
			localStorage.removeItem('kanban-pending-invite')
			navigate(`/workspaces/${data.boardId}`, { replace: true })
		}).catch((requestError) => setError(requestError.response?.data?.message || 'This invite is no longer available'))
	}, [authUser, navigate, token])

	return (
		<main className='invite-page'><section className='account-page-card invite-card'><div className='invite-icon'><Link2 size={24} /></div><p className='eyebrow'>Workspace invitation</p><h1>Join a shared board.</h1>{error ? <><p>{error}</p><Link className='primary-button' to='/'>Back home <ArrowRight size={16} /></Link></> : authUser ? <><CheckCircle2 size={22} /><p>Accepting your invitation...</p></> : <><p>Sign in or create an account to accept this one-time invitation.</p><div className='invite-actions'><Link className='primary-button' to='/login'>Sign in <ArrowRight size={16} /></Link><Link className='quiet-button' to='/signup'>Create account</Link></div></>}</section></main>
	)
}

export default BoardInvite
