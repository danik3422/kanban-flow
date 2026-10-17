import { Check, Languages, LogOut, Monitor, Moon, Settings2, Sun, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES, useI18n } from '../../i18n'
import { useAuthStore } from '../../store/useAuthStore'
import { Avatar, Menu } from '../../ui'
import { applyTheme, useThemeStore } from '../../utils/theme'

const THEME_ICONS = { light: Sun, dark: Moon, system: Monitor }

/** The signed-in person: profile, settings, theme, language and sign-out in one menu. */
const AccountMenu = () => {
	const { t, language, setLanguage } = useI18n()
	const navigate = useNavigate()
	const { authUser, logout } = useAuthStore()
	const theme = useThemeStore((state) => state.theme)
	const name = authUser?.name || authUser?.email || ''

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
				{ separator: true },
				{ heading: t('app.account.theme') },
				...['light', 'dark', 'system'].map((option) => ({
					label: t(`theme.${option}`),
					icon: option === theme ? Check : THEME_ICONS[option],
					checked: option === theme,
					onSelect: () => applyTheme(option),
				})),
				{ separator: true },
				{ heading: t('app.account.language') },
				...SUPPORTED_LANGUAGES.map((code) => ({
					label: LANGUAGE_NAMES[code],
					icon: code === language ? Check : Languages,
					checked: code === language,
					lang: code,
					onSelect: () => setLanguage(code),
				})),
				{ separator: true },
				{ label: t('app.account.logout'), icon: LogOut, tone: 'danger', onSelect: logout },
			]}
		/>
	)
}

export default AccountMenu
