import { Check, Circle } from 'lucide-react'
import { FaApple, FaMicrosoft } from 'react-icons/fa'
import { FcGoogle } from 'react-icons/fc'
import { useI18n } from '../../i18n'
import { Button } from '../../ui'
import { passwordChecksFor } from '../../utils/password'
import './password-rules.css'

export const AuthHeading = ({ title, subtitle }) => (
	<div className='auth-heading'>
		<h1 className='auth-heading__title'>{title}</h1>
		{subtitle && <p className='auth-heading__subtitle'>{subtitle}</p>}
	</div>
)

const PROVIDER_ICONS = {
	google: <FcGoogle size={18} aria-hidden='true' />,
	microsoft: <FaMicrosoft size={16} aria-hidden='true' color='#00A4EF' />,
	apple: <FaApple size={18} aria-hidden='true' />,
}

export const ProviderIcon = ({ provider }) => PROVIDER_ICONS[provider] || null

export const ProviderButtons = ({ onSelect, disabled }) => {
	const { t } = useI18n()
	return (
		<div className='auth-providers-block'>
			<div className='auth-divider'><span>{t('auth.providers.divider')}</span></div>
			<div className='auth-providers-list'>
				{['google', 'microsoft', 'apple'].map((provider) => (
					<Button key={provider} variant='secondary' block size='lg' disabled={disabled} onClick={() => onSelect(provider)}>
						{PROVIDER_ICONS[provider]}
						{t(`auth.providers.${provider}`)}
					</Button>
				))}
			</div>
		</div>
	)
}

export const PasswordRules = ({ password, id }) => {
	const { t } = useI18n()
	const checks = passwordChecksFor(password)
	return (
		<div className='password-rules' id={id}>
			<span className='password-rules__title'>{t('auth.rules.title')}</span>
			<ul>
				{Object.entries(checks).map(([rule, met]) => (
					<li key={rule} className={met ? 'is-met' : undefined}>
						{met ? <Check size={14} aria-hidden='true' /> : <Circle size={14} aria-hidden='true' />}
						<span>{t(`auth.rules.${rule}`)}</span>
						<span className='ui-visually-hidden'>{met ? t('auth.rules.met') : t('auth.rules.notMet')}</span>
					</li>
				))}
			</ul>
		</div>
	)
}

/** A finished or blocked step: icon, message and what to do next. */
export const AuthStatus = ({ icon: Icon, tone = 'accent', title, children, actions }) => (
	<div className='auth-status' role='status'>
		<span className={`auth-status__icon auth-status__icon--${tone}`} aria-hidden='true'><Icon size={24} /></span>
		<h1 className='auth-heading__title'>{title}</h1>
		{children && <div className='auth-status__text'>{children}</div>}
		{actions && <div className='auth-status__actions'>{actions}</div>}
	</div>
)
