import { CalendarDays, Columns3, Layers, Table2 } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useI18n } from '../../../i18n'
import { cx } from '../../../ui/utils'
import './board-dock.css'
import { shortcutKey } from '../../../lib/shortcutKey'

const isTyping = (target) => target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

const DockItem = ({ icon: Icon, label, keys, active, pressed, onClick }) => (
	<button type='button' className={cx('bd-item', active && 'is-active')} onClick={onClick} aria-pressed={pressed} aria-keyshortcuts={keys.join(' ').replace('+', ' ')}>
		<Icon size={17} aria-hidden='true' />
		<span>{label}</span>
		<span className='bd-tip' role='tooltip'>
			{label}
			{keys.map((key) => <kbd key={key}>{key}</kbd>)}
		</span>
	</button>
)

/**
 * The board's floating switcher, Trello-style: show or hide the planner and the board
 * or the table (at least one stays open), and jump to another board. Shortcuts: g then p,
 * g then b, g then t, and b, in any keyboard layout. Phones use the app's bottom bar instead.
 */
const BoardDock = ({ plannerOpen, boardVisible, tableVisible, onTogglePlanner, onToggleBoard, onToggleTable, onSwitchBoards }) => {
	const { t } = useI18n()
	const pendingG = useRef(0)

	useEffect(() => {
		const onKey = (event) => {
			if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target) || document.body.classList.contains('has-modal')) return
			const key = shortcutKey(event)
			const afterG = Date.now() - pendingG.current < 1200
			if (key === 'g') {
				pendingG.current = Date.now()
				return
			}
			if (afterG && key === 'p') {
				event.preventDefault()
				pendingG.current = 0
				onTogglePlanner()
			} else if (afterG && key === 'b') {
				event.preventDefault()
				pendingG.current = 0
				onToggleBoard()
			} else if (afterG && key === 't') {
				event.preventDefault()
				pendingG.current = 0
				onToggleTable()
			} else if (key === 'b') {
				event.preventDefault()
				onSwitchBoards()
			}
		}
		document.addEventListener('keydown', onKey)
		return () => document.removeEventListener('keydown', onKey)
	}, [onTogglePlanner, onToggleBoard, onToggleTable, onSwitchBoards])

	return (
		<nav className='bd' aria-label={t('boardDock.label')}>
			<DockItem icon={CalendarDays} label={t('boardDock.planner')} keys={['g+p']} active={plannerOpen} pressed={plannerOpen} onClick={onTogglePlanner} />
			<DockItem icon={Columns3} label={t('boardDock.board')} keys={['g+b']} active={boardVisible} pressed={boardVisible} onClick={onToggleBoard} />
			<DockItem icon={Table2} label={t('boardDock.table')} keys={['g+t']} active={tableVisible} pressed={tableVisible} onClick={onToggleTable} />
			<span className='bd-divider' aria-hidden='true' />
			<DockItem icon={Layers} label={t('boardDock.switch')} keys={['b']} onClick={onSwitchBoards} />
		</nav>
	)
}

export default BoardDock
