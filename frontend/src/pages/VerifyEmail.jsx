import { ArrowRight, CheckCircle2, ExternalLink, LogIn, LogOut, MailCheck, MailWarning } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import AuthLayout from '../components/auth/AuthLayout'
import { AuthStatus } from '../components/auth/AuthParts'
import { useI18n } from '../i18n'
import { translateServerMessage } from '../i18n/translate'
import { axiosInstance } from '../lib/axios'
import { useAuthStore } from '../store/useAuthStore'
import { Alert, Button, Spinner } from '../ui'
import { startPagePath } from '../utils/preferences'

const RESEND_COOLDOWN_KEY = 'kanban-email-resend-cooldown'
const PENDING_TOKEN_KEY = 'kanban-pending-verification-token'

const readStoredResendCooldown = () => {
	try {
		const expiresAt = Number(window.sessionStorage.getItem(RESEND_COOLDOWN_KEY))
		const remaining = Math.ceil((expiresAt - Date.now()) / 1000)
		return Number.isFinite(remaining) && remaining > 0 ? remaining : 0
	} catch {
		return 0
	}
}

const persistResendCooldown = (seconds) => {
	try {
		if (seconds > 0) window.sessionStorage.setItem(RESEND_COOLDOWN_KEY, String(Date.now() + seconds * 1000))
		else window.sessionStorage.removeItem(RESEND_COOLDOWN_KEY)
	} catch {
		// The countdown still runs for this visit.
	}
}

const toSeconds = (value) => {
	const seconds = Number(value)
	return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 0
}

// A shortcut to the inbox for the common providers; others just get the hint text.
const MAIL_APPS = [
	[/^(gmail|googlemail)\.com$/, 'Gmail', 'https://mail.google.com/mail/u/0/#inbox'],
	[/^(outlook|hotmail|live|msn)\.[a-z.]+$/, 'Outlook', 'https://outlook.live.com/mail/0/inbox'],
	[/^(yahoo|ymail)\.[a-z.]+$/, 'Yahoo Mail', 'https://mail.yahoo.com'],
	[/^(icloud|me|mac)\.com$/, 'iCloud Mail', 'https://www.icloud.com/mail'],
	[/^proton(mail)?\.(me|com)$/, 'Proton Mail', 'https://mail.proton.me'],
	[/^ukr\.net$/, 'UKR.NET', 'https://mail.ukr.net'],
]
const mailAppFor = (email = '') => {
	const domain = email.split('@')[1]?.toLowerCase() || ''
	const match = MAIL_APPS.find(([pattern]) => pattern.test(domain))
	return match ? { name: match[1], url: match[2] } : null
}

const formatCooldown = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

const VerifyEmail = () => {
	const { t, tNode, language } = useI18n()
	const navigate = useNavigate()
	const { authUser, checkAuth, logout } = useAuthStore()
	const [token] = useState(() => {
		const urlToken = new URLSearchParams(window.location.search).get('token')
		// The link is often opened before signing in; keep the token across the login detour.
		try {
			if (urlToken) window.sessionStorage.setItem(PENDING_TOKEN_KEY, urlToken)
			return urlToken || window.sessionStorage.getItem(PENDING_TOKEN_KEY) || ''
		} catch {
			return urlToken || ''
		}
	})
	const isVerified = Boolean(authUser?.emailVerified)
	const [status, setStatus] = useState(token && !isVerified ? 'checking' : 'waiting')
	const [errorMessage, setErrorMessage] = useState('')
	const [isResending, setIsResending] = useState(false)
	const [justSent, setJustSent] = useState(false)
	const [cooldown, setCooldown] = useState(readStoredResendCooldown)

	// The one-time token is kept in memory and session storage, never left in the address bar.
	useEffect(() => {
		const cleanUrl = new URL(window.location.href)
		if (!cleanUrl.searchParams.has('token')) return
		cleanUrl.searchParams.delete('token')
		window.history.replaceState(window.history.state, document.title, `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`)
	}, [])

	// Already confirmed (an old link, or confirmed elsewhere): nothing left to submit.
	useEffect(() => {
		if (!isVerified) return
		try {
			window.sessionStorage.removeItem(PENDING_TOKEN_KEY)
		} catch {
			// Nothing stored in private mode.
		}
	}, [isVerified])

	// Confirmed on another device: notice it when the tab regains focus or every 15 s.
	useEffect(() => {
		if (!authUser || isVerified || status !== 'waiting') return undefined
		const check = () => {
			if (document.visibilityState === 'visible') checkAuth()
		}
		const timer = window.setInterval(check, 15000)
		window.addEventListener('focus', check)
		document.addEventListener('visibilitychange', check)
		return () => {
			window.clearInterval(timer)
			window.removeEventListener('focus', check)
			document.removeEventListener('visibilitychange', check)
		}
	}, [authUser, isVerified, status, checkAuth])

	// checkAuth() below changes authUser and re-runs this effect, so guard against
	// submitting the one-time token twice.
	const verificationStartedRef = useRef(false)
	useEffect(() => {
		if (!token || !authUser || isVerified || verificationStartedRef.current) return
		verificationStartedRef.current = true
		try {
			window.sessionStorage.removeItem(PENDING_TOKEN_KEY)
		} catch {
			// Storage can be unavailable in private mode.
		}
		axiosInstance
			.post('/auth/verify-email', { token })
			.then(async () => {
				await checkAuth()
				toast.success(t('auth.verify.verified'))
				navigate('/setup-profile', { replace: true })
			})
			.catch((error) => {
				setStatus('expired')
				setErrorMessage(error.response?.data?.message || '')
			})
	}, [token, authUser, isVerified, checkAuth, navigate, t])

	useEffect(() => {
		if (cooldown <= 0) return undefined
		const timer = window.setTimeout(() => {
			setCooldown((current) => {
				const next = Math.max(0, current - 1)
				persistResendCooldown(next)
				return next
			})
		}, 1000)
		return () => window.clearTimeout(timer)
	}, [cooldown])

	const startCooldown = (seconds) => {
		setCooldown(seconds)
		persistResendCooldown(seconds)
	}

	const handleResend = async () => {
		if (!authUser?.email) return
		setIsResending(true)
		try {
			const { data } = await axiosInstance.post('/auth/verify-email/resend', { email: authUser.email })
			startCooldown(toSeconds(data.retryAfter) || 60)
			setJustSent(true)
			toast.success(t('auth.verify.sent'))
		} catch (error) {
			const retryAfter = toSeconds(error.response?.data?.retryAfter) || toSeconds(error.response?.headers?.['retry-after']) || 60
			if (error.response?.status === 429) {
				startCooldown(retryAfter)
				toast.error(t('auth.verify.waitBeforeResend', { time: formatCooldown(retryAfter) }))
			} else {
				toast.error(translateServerMessage(language, error.response?.data?.message))
			}
		} finally {
			setIsResending(false)
		}
	}

	const handleLogout = async () => {
		await logout()
		navigate('/login', { replace: true })
	}

	if (!authUser) {
		return (
			<AuthLayout panel='verify'>
				<AuthStatus
					icon={LogIn}
					title={t('auth.verify.signInTitle')}
					actions={<Button as={Link} to={`/login?redirect=${encodeURIComponent('/verify-email')}`} block size='lg' icon={LogIn}>{t('auth.verify.signIn')}</Button>}
				>
					<p>{token ? t('auth.verify.signInText') : t('auth.verify.signInPlain')}</p>
				</AuthStatus>
			</AuthLayout>
		)
	}

	if (isVerified) {
		return (
			<AuthLayout panel='verify'>
				<AuthStatus
					icon={CheckCircle2}
					tone='success'
					title={t('auth.verify.verifiedTitle')}
					actions={<Button as={Link} to={startPagePath()} block size='lg' iconRight={ArrowRight}>{t('auth.verify.continue')}</Button>}
				>
					<p>{tNode('auth.verify.verifiedText', { email: <strong>{authUser.email}</strong> })}</p>
				</AuthStatus>
			</AuthLayout>
		)
	}

	const mailApp = mailAppFor(authUser.email)

	const actions = (
		<>
			{mailApp && status === 'waiting' && (
				<Button as='a' href={mailApp.url} target='_blank' rel='noopener noreferrer' block size='lg' iconRight={ExternalLink}>
					{t('auth.verify.openMail', { provider: mailApp.name })}
				</Button>
			)}
			<Button block size='lg' variant={mailApp && status === 'waiting' ? 'secondary' : 'primary'} onClick={handleResend} loading={isResending} disabled={cooldown > 0}>
				{isResending
					? t('auth.verify.sending')
					: cooldown > 0
						? t('auth.verify.resendIn', { time: formatCooldown(cooldown) })
						: t('auth.verify.resend')}
			</Button>
			<Button variant='ghost' block icon={LogOut} onClick={handleLogout}>{t('auth.verify.otherAccount')}</Button>
		</>
	)

	return (
		<AuthLayout panel='verify'>
			{status === 'checking' ? (
				<AuthStatus icon={MailCheck} title={t('auth.verify.checking')}>
					<Spinner size={20} />
				</AuthStatus>
			) : status === 'expired' ? (
				<AuthStatus icon={MailWarning} tone='danger' title={t('auth.verify.expiredTitle')} actions={actions}>
					{errorMessage ? translateServerMessage(language, errorMessage, 'auth.verify.expiredHelp') : t('auth.verify.expiredHelp')}
				</AuthStatus>
			) : (
				<AuthStatus icon={MailCheck} title={t('auth.verify.title')} actions={actions}>
					<p>{tNode('auth.verify.subtitle', { email: <strong>{authUser.email}</strong> })}</p>
					<p>{t('auth.verify.help')}</p>
					<p>{t('auth.verify.autoContinue')}</p>
					{justSent && cooldown > 0 && <Alert tone='success'>{t('auth.verify.sent')}</Alert>}
				</AuthStatus>
			)}
		</AuthLayout>
	)
}

export default VerifyEmail
