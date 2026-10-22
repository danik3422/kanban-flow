import { Languages, Lightbulb, LogOut, Monitor, Moon, Settings2, Sun, UserRound } from 'lucide-react'
import useIsPhone from '../../hooks/useIsPhone'
import { useNavigate } from 'react-router-dom'
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES, useI18n } from '../../i18n'
import { useAuthStore } from '../../store/useAuthStore'
import { Avatar, Menu } from '../../ui'
import { applyTheme, useThemeStore } from '../../lib/theme'

const THEME_ICONS = { light: Sun, dark: Moon, system: Monitor }

/** The signed-in person: profile, settings, theme, language and sign-out in one menu. */
const AccountMenu = () => {
	const { t, language, setLanguage } = useI18n()
	const navigate = useNavigate()
	const { authUser, logout } = useAuthStore()
	const theme = useThemeStore((state) => state.theme)
	const name = authUser?.name || authUser?.email || ''
	// Phones have no room for the light bulb in the top bar; the tips live here instead.
	const isPhone = useIsPhone()

	return (
		<Menu
			label={t('app.account.label')}
			trigger={(props) => (
				<button type='button' className='app-account-trigger' aria-label={`${t('app.account.label')}: ${name}`} data-i18n-ignore {...props}>
					<Avatar name={name} src={authUser?.avatar} size={32} decorative />
				</button>
			)}
			items={[
				{ header: { title: authUser?.name || authUser?.email || '', subtitle: authUser?.name ? authUser?.email : '' } },
				{ label: t('app.account.profile'), icon: UserRound, onSelect: () => navigate('/profile') },
				{ label: t('app.account.settings'), icon: Settings2, onSelect: () => navigate('/settings') },
				...(isPhone ? [{ label: t('tips.label'), icon: Lightbulb, onSelect: () => window.dispatchEvent(new CustomEvent('kh:tips')) }] : []),
				{ separator: true },
				{
					group: {
						id: 'theme',
						label: t('app.account.theme'),
						icon: THEME_ICONS[theme] || Monitor,
						value: t(`theme.${theme}`),
						items: ['light', 'dark', 'system'].map((option) => ({
							label: t(`theme.${option}`),
							icon: THEME_ICONS[option],
							checked: option === theme,
							mark: 'end',
							onSelect: () => applyTheme(option),
						})),
					},
				},
				{
					group: {
						id: 'language',
						label: t('app.account.language'),
						icon: Languages,
						value: LANGUAGE_NAMES[language],
						valueLang: language,
						items: SUPPORTED_LANGUAGES.map((code) => ({
							label: LANGUAGE_NAMES[code],
							checked: code === language,
							mark: 'end',
							lang: code,
							onSelect: () => setLanguage(code),
						})),
					},
				},
				{ separator: true },
				{ label: t('app.account.logout'), icon: LogOut, tone: 'danger', onSelect: logout },
			]}
		/>
	)
}

export default AccountMenu
