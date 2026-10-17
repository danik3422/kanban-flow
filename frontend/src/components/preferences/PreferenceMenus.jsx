import { Check, Languages, Monitor, Moon, Sun } from 'lucide-react'
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES, useI18n } from '../../i18n'
import { IconButton, Menu } from '../../ui'
import { applyTheme, useThemeStore } from '../../utils/theme'

const THEME_ICONS = { light: Sun, dark: Moon, system: Monitor }

export const ThemeMenu = () => {
	const { t } = useI18n()
	const theme = useThemeStore((state) => state.theme)
	return (
		<Menu
			label={t('theme.label')}
			trigger={(props) => <IconButton {...props} icon={THEME_ICONS[theme]} label={`${t('theme.label')}: ${t(`theme.${theme}`)}`} />}
			items={['light', 'dark', 'system'].map((option) => ({
				label: t(`theme.${option}`),
				icon: option === theme ? Check : THEME_ICONS[option],
				checked: option === theme,
				onSelect: () => applyTheme(option),
			}))}
		/>
	)
}

export const LanguageMenu = () => {
	const { t, language, setLanguage } = useI18n()
	return (
		<Menu
			label={t('language.label')}
			trigger={(props) => <IconButton {...props} icon={Languages} label={`${t('language.label')}: ${LANGUAGE_NAMES[language]}`} />}
			items={SUPPORTED_LANGUAGES.map((code) => ({
				label: LANGUAGE_NAMES[code],
				icon: code === language ? Check : undefined,
				checked: code === language,
				lang: code,
				onSelect: () => setLanguage(code),
			}))}
		/>
	)
}
