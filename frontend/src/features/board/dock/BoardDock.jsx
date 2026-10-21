import { CalendarDays, Columns3, Layers } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useI18n } from '../../../i18n'
import { cx } from '../../../ui/utils'
import './board-dock.css'

const isTyping = (target) => target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

const DockItem = ({ icon: Icon, label, keys, active, onClick }) => (
	<button type='button' className={cx('bd-item', active && 'is-active')} onClick={onClick} aria-current={active ? 'page' : undefined} aria-keyshortcuts={keys.join(' ').replace('+', ' ')}>
		<Icon size={17} aria-hidden='true' />
		<span>{label}</span>
		<span className='bd-tip' role='tooltip'>
			{label}
			{keys.map((key) => <kbd key={key}>{key}</kbd>)}
		</span>
	</button>
)

/**
 * The board's floating switcher, Trello-style: the planner (this board in the
 * calendar), the board itself, and jumping to another board. Shortcuts: g then p,
 * g then b, and b. Phones use the app's bottom bar instead.
 */
const BoardDock = ({ onPlanner, onSwitchBoards }) => {
	const { t } = useI18n()
	const pendingG = useRef(0)

	useEffect(() => {
		const onKey = (event) => {
			if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target) || document.body.classList.contains('has-modal')) return
			const key = event.key.toLowerCase()
			const afterG = Date.now() - pendingG.current < 1200
			if (key === 'g') {
				pendingG.current = Date.now()
				return
			}
			if (afterG && key === 'p') {
				event.preventDefault()
				pendingG.current = 0
				onPlanner()
			} else if (afterG && key === 'b') {
				pendingG.current = 0
			} else if (key === 'b') {
				event.preventDefault()
				onSwitchBoards()
			}
		}
		document.addEventListener('keydown', onKey)
		return () => document.removeEventListener('keydown', onKey)
	}, [onPlanner, onSwitchBoards])

	return (
		<nav className='bd' aria-label={t('boardDock.label')}>
			<DockItem icon={CalendarDays} label={t('boardDock.planner')} keys={['g+p']} onClick={onPlanner} />
			<DockItem icon={Columns3} label={t('boardDock.board')} keys={['g+b']} active onClick={() => {}} />
			<span className='bd-divider' aria-hidden='true' />
			<DockItem icon={Layers} label={t('boardDock.switch')} keys={['b']} onClick={onSwitchBoards} />
		</nav>
	)
}

export default BoardDock
