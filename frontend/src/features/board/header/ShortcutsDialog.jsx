import { useI18n } from '../../../i18n'
import { Modal } from '../../../ui'

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
const ALT = isMac ? '⌥' : 'Alt'
const MOD = isMac ? '⌘' : 'Ctrl'

// What each key does on a board; "card" keys act on the card under the pointer or the selected one.
const GROUPS = [
	{ key: 'board', rows: [['n', ['N']], ['filter', ['F']], ['mine', ['Q']], ['search', [MOD, 'K']], ['help', ['?']]] },
	{ key: 'card', rows: [['open', ['Enter']], ['me', ['M']], ['complete', ['C']], ['archive', ['A']]] },
	{ key: 'views', rows: [['planner', ['G', 'P']], ['board', ['G', 'B']], ['table', ['G', 'T']], ['switchBoards', ['B']]] },
	{ key: 'move', rows: [['select', ['↑', '↓', '←', '→']], ['moveInList', [ALT, '↑ ↓']], ['moveToList', [ALT, '← →']], ['close', ['Esc']]] },
]

/** Every board shortcut on one page, opened with "?" or from the board menu. */
const ShortcutsDialog = ({ open, onClose }) => {
	const { t } = useI18n()
	return (
		<Modal open={open} onClose={onClose} title={t('shortcuts.title')} description={t('shortcuts.description')} className='shortcuts-dialog'>
			<div className='shortcuts'>
				{GROUPS.map((group) => (
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
