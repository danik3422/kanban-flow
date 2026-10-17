import { LogOut, MailCheck, MailWarning } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import AuthLayout from '../components/auth/AuthLayout'
import { AuthStatus } from '../components/auth/AuthParts'
import { useI18n } from '../i18n'
import { translateServerMessage } from '../i18n/translate'
import { axiosInstance } from '../lib/axios'
import { useAuthStore } from '../store/useAuthStore'
import { Alert, Button, Spinner } from '../ui'

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
	const [status, setStatus] = useState(token ? 'checking' : 'waiting')
	const [errorMessage, setErrorMessage] = useState('')
	const [isResending, setIsResending] = useState(false)
	const [justSent, setJustSent] = useState(false)
	const [cooldown, setCooldown] = useState(readStoredResendCooldown)

	useEffect(() => {
		if (!authUser) navigate('/login', { replace: true })
	}, [authUser, navigate])

	// checkAuth() below changes authUser and re-runs this effect, so guard against
	// submitting the one-time token twice.
	const verificationStartedRef = useRef(false)
	useEffect(() => {
		if (!token || !authUser || verificationStartedRef.current) return
		verificationStartedRef.current = true
		const cleanUrl = new URL(window.location.href)
		cleanUrl.searchParams.delete('token')
		window.history.replaceState(window.history.state, document.title, `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`)
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
	}, [token, authUser, checkAuth, navigate, t])

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

	if (!authUser) return null

	const actions = (
		<>
			<Button block size='lg' onClick={handleResend} loading={isResending} disabled={cooldown > 0}>
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
					{justSent && cooldown > 0 && <Alert tone='success'>{t('auth.verify.sent')}</Alert>}
				</AuthStatus>
			)}
		</AuthLayout>
	)
}

export default VerifyEmail
