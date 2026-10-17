import { Link } from 'react-router-dom'
import { useI18n } from '../../i18n'
import { LanguageMenu, ThemeMenu } from '../preferences/PreferenceMenus'
import BrandMark from '../BrandMark'
import { LoginScene, RecoveryScene, SignupScene, VerifyScene } from './AuthScenes'
import './auth.css'

const SCENES = { login: LoginScene, signup: SignupScene, recovery: RecoveryScene, verify: VerifyScene }

/**
 * Shared frame for sign-in, sign-up, recovery, verification and onboarding.
 * The brand panel is a column with a scene for the current step on wide
 * screens and a compact header on phones, where the form slides over it as a sheet.
 */
const AuthLayout = ({ panel, scene, children }) => {
	const { t } = useI18n()
	const Scene = SCENES[panel]
	return (
		<div className='auth-shell'>
			<aside className='auth-shell__hero'>
				<Link to='/' className='auth-shell__brand' aria-label={t('common.homeLink')}>
					<BrandMark />
				</Link>
				<div className='auth-shell__scene' aria-hidden='true'>{scene || (Scene && <Scene />)}</div>
				<div className='auth-shell__story' aria-hidden='true'>
					<p className='auth-shell__eyebrow'>{t(`auth.panel.${panel}.eyebrow`)}</p>
					<p className='auth-shell__headline'>{t(`auth.panel.${panel}.title`)}</p>
					<p className='auth-shell__lead'>{t(`auth.panel.${panel}.subtitle`)}</p>
				</div>
			</aside>
			<div className='auth-shell__prefs'>
				<LanguageMenu />
				<ThemeMenu />
			</div>
			<main className='auth-shell__content'>
				<div className='auth-shell__form'>{children}</div>
			</main>
		</div>
	)
}

export default AuthLayout
