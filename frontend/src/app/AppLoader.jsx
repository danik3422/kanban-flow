import { useI18n } from '../i18n'
import './app-loader.css'
import { LogoMark } from '../ui/BrandMark'

/**
 * Full-screen loader for the session check and page chunks. It stays invisible
 * for the first moments so fast loads never flash a spinner.
 */
const AppLoader = ({ page = false }) => {
	const { t } = useI18n()
	return (
		<div className='app-loader' role='status' aria-live='polite'>
			<div className='app-loader__content'>
				<LogoMark size={52} className='app-loader__mark' />
				<span className='app-loader__bar' aria-hidden='true'><span /></span>
				<span className='ui-visually-hidden'>{t(page ? 'loading.page' : 'loading.app')}</span>
			</div>
		</div>
	)
}

export default AppLoader
