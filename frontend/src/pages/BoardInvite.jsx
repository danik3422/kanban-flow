import { AlertTriangle, ArrowRight, Copy, LayoutGrid, Link2Off, LogIn, Mail, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import '../components/app/app-shell.css'
import AuthLayout from '../components/auth/AuthLayout'
import { AuthHeading, AuthStatus } from '../components/auth/AuthParts'
import InviteScene, { InviteBoardCard } from '../components/invite/InviteBoardCard'
import '../components/invite/invite.css'
import { useI18n } from '../i18n'
import { intlLocale, translateServerMessageCurrent } from '../i18n/translate'
import { axiosInstance } from '../lib/axios'
import { clearBoardsCache } from '../lib/boardsCache'
import { useAuthStore } from '../store/useAuthStore'
import { useBoardStats } from '../store/useBoardStats'
import { Alert, Avatar, Button, Field, Input, Skeleton } from '../ui'
import { startPagePath } from '../utils/preferences'

const PENDING_INVITE_KEY = 'kanban-pending-invite'

const setPendingInvite = (token) => {
	try {
		if (token) localStorage.setItem(PENDING_INVITE_KEY, token)
		else localStorage.removeItem(PENDING_INVITE_KEY)
	} catch {
		// Without storage the user simply opens the link again after signing in.
	}
}

// Accepts a full link (…/invite/<token>) or the bare token.
const tokenFrom = (value) => {
	const text = value.trim()
	const fromPath = text.match(/\/invite\/([A-Za-z0-9_-]{8,})/)
	if (fromPath) return fromPath[1]
	return /^[A-Za-z0-9_-]{16,}$/.test(text) ? text : ''
}

/** /invite without a token: paste the link from an email or a chat. */
const PasteInvite = () => {
	const { t } = useI18n()
	const navigate = useNavigate()
	const [value, setValue] = useState('')
	const [error, setError] = useState('')
	const submit = (event) => {
		event.preventDefault()
		const token = tokenFrom(value)
		if (!token) {
			setError(t('invite.pasteInvalid'))
			return
		}
		navigate(`/invite/${token}`)
	}
	return (
		<form className='inv-paste' onSubmit={submit} noValidate>
			<AuthHeading title={t('invite.pasteTitle')} subtitle={t('invite.pasteText')} />
			<Field label={t('invite.pasteLabel')} error={error}>
				<Input
					value={value}
					onChange={(event) => {
						setValue(event.target.value)
						setError('')
					}}
					placeholder={t('invite.pastePlaceholder')}
					autoComplete='off'
					inputMode='url'
					autoFocus
				/>
			</Field>
			<Button type='submit' size='lg' block iconRight={ArrowRight}>{t('invite.pasteOpen')}</Button>
		</form>
	)
}

const BoardInvite = () => {
	const { token } = useParams()
	const { t, language } = useI18n()
	const navigate = useNavigate()
	const authUser = useAuthStore((state) => state.authUser)
	const logout = useAuthStore((state) => state.logout)
	const [details, setDetails] = useState(null)
	// loading | ready | invalid; accept can move ready to owner, member or wrong-email.
	const [state, setState] = useState(token ? 'loading' : 'paste')
	const [override, setOverride] = useState(null)
	const [isJoining, setIsJoining] = useState(false)

	useEffect(() => {
		if (!token) return undefined
		let ignore = false
		axiosInstance
			.get(`/board/invites/${token}/details`)
			.then(({ data }) => {
				if (ignore) return
				setDetails(data)
				setOverride(null)
				setState('ready')
			})
			.catch(() => {
				if (ignore) return
				setPendingInvite(null)
				setState('invalid')
			})
		return () => {
			ignore = true
		}
	}, [token, authUser?._id])

	// Signed-out visitors keep the invite for after sign-in; signed-in users decide here.
	useEffect(() => {
		if (state === 'ready') setPendingInvite(authUser ? null : token)
	}, [authUser, state, token])

	const viewer = override || details?.viewer
	const boardName = details?.boardName || ''
	const inviter = details?.invitedBy?.name || details?.invitedBy?.email || ''
	const loginUrl = `/login?redirect=${encodeURIComponent(`/invite/${token}`)}`
	const homeAction = authUser
		? <Button as={Link} to={startPagePath()} variant='secondary' size='lg' block icon={LayoutGrid}>{t('invite.toBoards')}</Button>
		: <Button as={Link} to='/' variant='secondary' size='lg' block>{t('invite.home')}</Button>
	const openBoard = <Button as={Link} to={`/workspaces/${details?.boardId}`} size='lg' block iconRight={ArrowRight}>{t('invite.openBoard')}</Button>

	const join = async () => {
		setIsJoining(true)
		try {
			const { data } = await axiosInstance.post(`/board/invites/${token}/accept`)
			clearBoardsCache()
			useBoardStats.getState().reset?.()
			toast.success(t('invite.joined', { board: boardName }))
			navigate(`/workspaces/${data.boardId}`, { replace: true })
		} catch (error) {
			const body = error.response?.data || {}
			if (body.code === 'wrong-email') setOverride('wrong-email')
			else if (/already a member/i.test(body.message || '')) setOverride('member')
			else if (/invite yourself/i.test(body.message || '')) setOverride('owner')
			else if (/expired or invalid/i.test(body.message || '')) setState('invalid')
			else toast.error(translateServerMessageCurrent(body.message, 'invite.joinError'))
		} finally {
			setIsJoining(false)
		}
	}

	const switchAccount = async () => {
		setPendingInvite(token)
		await logout()
		navigate(loginUrl, { replace: true })
	}

	const copyLink = async () => {
		try {
			await navigator.clipboard.writeText(window.location.href)
			toast.success(t('invite.copied'))
		} catch {
			toast.error(t('invite.joinError'))
		}
	}

	let content
	if (state === 'paste') {
		content = <PasteInvite />
	} else if (state === 'loading') {
		content = (
			<div className='inv-loading' aria-busy='true' aria-label={t('invite.loading')}>
				<Skeleton width='70%' height={32} />
				<Skeleton width='90%' height={16} />
				<Skeleton height={76} radius={16} />
				<Skeleton height={48} radius={12} />
			</div>
		)
	} else if (state === 'invalid') {
		content = (
			<AuthStatus icon={Link2Off} tone='danger' title={t('invite.invalidTitle')} actions={homeAction}>
				<p>{t('invite.invalidText')}</p>
			</AuthStatus>
		)
	} else if (viewer === 'owner') {
		content = (
			<AuthStatus
				icon={LayoutGrid}
				title={t('invite.ownerTitle')}
				actions={<>{openBoard}<Button variant='secondary' size='lg' block icon={Copy} onClick={copyLink}>{t('invite.copyLink')}</Button></>}
			>
				<p>{t('invite.ownerText', { board: boardName })}</p>
			</AuthStatus>
		)
	} else if (viewer === 'member') {
		content = (
			<AuthStatus icon={LayoutGrid} tone='success' title={t('invite.memberTitle')} actions={openBoard}>
				<p>{t('invite.memberText', { board: boardName })}</p>
			</AuthStatus>
		)
	} else if (viewer === 'wrong-email') {
		content = (
			<AuthStatus
				icon={AlertTriangle}
				tone='warning'
				title={t('invite.wrongEmailTitle')}
				actions={<><Button size='lg' block icon={LogIn} onClick={switchAccount}>{t('invite.switchAccount')}</Button>{homeAction}</>}
			>
				<p>{t('invite.wrongEmailText', { email: details?.emailHint || '', current: authUser?.email || '', name: inviter || t('invite.someone') })}</p>
			</AuthStatus>
		)
	} else {
		const expires = details?.expiresAt
			? new Intl.DateTimeFormat(intlLocale(language), { day: 'numeric', month: 'long' }).format(new Date(details.expiresAt))
			: ''
		content = (
			<div className='inv'>
				<AuthHeading
					title={t('invite.title', { board: boardName })}
					subtitle={inviter ? t('invite.invitedBy', { name: inviter }) : t('invite.invitedAnon')}
				/>
				<div className='inv-summary'><InviteBoardCard details={details} compact /></div>
				{details?.emailHint && !authUser && (
					<Alert icon={Mail}>{t('invite.forEmail', { email: details.emailHint })}</Alert>
				)}
				{authUser ? (
					<>
						<div className='inv-account'>
							<Avatar name={authUser.name || authUser.email} src={authUser.avatar} size={36} decorative />
							<span className='inv-account__text'>
								<span className='inv-account__label'>{t('invite.signedInAs')}</span>
								<span className='inv-account__email' data-i18n-ignore>{authUser.email}</span>
							</span>
						</div>
						<p className='inv__lead'>{t('invite.as', { role: t(`invite.roles.${details?.role === 'admin' ? 'admin' : 'member'}`) })}</p>
						<div className='inv__actions'>
							<Button size='lg' block icon={UserPlus} onClick={join} loading={isJoining}>{isJoining ? t('invite.joining') : t('invite.join')}</Button>
							<Button as={Link} to={startPagePath()} variant='ghost' size='lg' block>{t('invite.notNow')}</Button>
						</div>
						<button type='button' className='inv-switch' onClick={switchAccount}>{t('invite.notYou')}</button>
					</>
				) : (
					<div className='inv__actions'>
						<Button as={Link} to={loginUrl} size='lg' block icon={LogIn}>{t('invite.signIn')}</Button>
						<Button as={Link} to='/signup' variant='secondary' size='lg' block>{t('invite.signUp')}</Button>
					</div>
				)}
				{expires && <p className='inv__note'>{t('invite.expires', { date: expires })}</p>}
			</div>
		)
	}

	return (
		<AuthLayout panel='invite' scene={details ? <InviteScene details={details} showInviter={!viewer || viewer === 'can-join'} /> : undefined}>
			{content}
		</AuthLayout>
	)
}

export default BoardInvite
