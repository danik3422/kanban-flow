import { useI18n } from '../../../i18n'
import { Modal } from '../../../ui'
import { SHORTCUT_GROUPS } from './shortcutGroups'

/** Every board shortcut on one page, opened with "?" or from the board menu. */
const ShortcutsDialog = ({ open, onClose }) => {
	const { t } = useI18n()
	return (
		<Modal open={open} onClose={onClose} title={t('shortcuts.title')} description={t('shortcuts.description')} className='shortcuts-dialog'>
			<div className='shortcuts'>
				{SHORTCUT_GROUPS.map((group) => (
					<section key={group.key} className='shortcuts__group'>
						<h3 className='shortcuts__title'>{t(`shortcuts.groups.${group.key}`)}</h3>
						<dl className='shortcuts__list'>
							{group.rows.map(([action, keys]) => (
								<div key={action} className='shortcuts__row'>
									<dt>{t(`shortcuts.actions.${action}`)}</dt>
									<dd>{keys.map((key) => <kbd key={key}>{key}</kbd>)}</dd>
								</div>
							))}
						</dl>
					</section>
				))}
			</div>
		</Modal>
	)
}

export default ShortcutsDialog
