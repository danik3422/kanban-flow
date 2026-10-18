import { ArrowLeft, Check, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import useIsPhone from '../../hooks/useIsPhone'
import { useI18n } from '../../i18n'
import { Button, Field, IconButton, Input, Modal, Select } from '../../ui'
import { cx } from '../../ui/utils'
import { COLUMN_COLOR_KEYS, COLUMN_COLORS } from '../../utils/columnColors'
import { SORT_OPTIONS } from '../../utils/taskSorting'

const PANEL_WIDTH = 304

/** A panel pinned under the button that opened it; closes on outside click or Escape. */
const AnchoredPanel = ({ anchor, label, onClose, onEscape, children }) => {
	const panelRef = useRef(null)
	const [style, setStyle] = useState({ visibility: 'hidden' })

	useLayoutEffect(() => {
		const place = () => {
			const rect = anchor?.getBoundingClientRect()
			if (!rect) return
			const left = Math.max(8, Math.min(rect.left, window.innerWidth - PANEL_WIDTH - 8))
			const top = rect.bottom + 6
			setStyle({ left, top, width: PANEL_WIDTH, maxHeight: Math.max(240, window.innerHeight - top - 12) })
		}
		place()
		window.addEventListener('resize', place)
		window.addEventListener('scroll', place, true)
		return () => {
			window.removeEventListener('resize', place)
			window.removeEventListener('scroll', place, true)
		}
	}, [anchor])

	useEffect(() => {
		const previous = document.activeElement
		panelRef.current?.querySelector('button, input, select')?.focus({ preventScroll: true })
		const onDown = (event) => {
			if (!panelRef.current?.contains(event.target) && !anchor?.contains(event.target)) onClose()
		}
		const onKey = (event) => {
			if (event.key === 'Escape') {
				event.stopPropagation()
				onEscape()
			}
		}
		document.addEventListener('mousedown', onDown)
		document.addEventListener('keydown', onKey, true)
		return () => {
			document.removeEventListener('mousedown', onDown)
			document.removeEventListener('keydown', onKey, true)
			if (previous instanceof HTMLElement && document.body.contains(previous)) previous.focus({ preventScroll: true })
		}
	}, [anchor, onClose, onEscape])

	return createPortal(
		<div ref={panelRef} className='bc-panel' role='dialog' aria-label={label} style={style}>
			{children}
		</div>,
		document.body,
	)
}

const Item = ({ children, onClick, tone, checked, disabled }) => (
	<button type='button' className={cx('bc-menu__item', tone === 'danger' && 'is-danger')} onClick={onClick} disabled={disabled} aria-pressed={checked === undefined ? undefined : checked}>
		<span>{children}</span>
		{checked && <Check size={16} aria-hidden='true' />}
	</button>
)

/**
 * Everything you can do with a list, Trello-style: add a card, copy, move, move
 * all its cards, sort, watch, pin, collapse, colour and delete. Managing actions
 * appear only for owners and admins.
 */
const ColumnActions = ({ open, anchor, column, columns, canManage, isWatching, isCollapsed, onClose, onAction }) => {
	const { t } = useI18n()
	const isPhone = useIsPhone()
	const [view, setView] = useState('main')
	const [copyTitle, setCopyTitle] = useState('')
	const [position, setPosition] = useState(0)
	const [wasOpen, setWasOpen] = useState(open)
	if (wasOpen !== open) {
		setWasOpen(open)
		if (open) {
			setView('main')
			setCopyTitle(column?.title || '')
			setPosition(Math.max(0, columns.findIndex((item) => item._id === column?._id)))
		}
	}
	if (!open || !column) return null

	const run = (type, payload) => {
		onAction(type, payload)
		onClose()
	}
	const otherColumns = columns.filter((item) => item._id !== column._id)
	const titles = {
		main: t('columns.menu.title'),
		copy: t('columns.menu.copy'),
		move: t('columns.menu.move'),
		moveCards: t('columns.menu.moveCards'),
		sort: t('columns.menu.sort'),
	}

	let content
	if (view === 'copy') {
		content = (
			<form className='bc-menu__form' onSubmit={(event) => { event.preventDefault(); if (copyTitle.trim()) run('copy', copyTitle.trim()) }}>
				<Field label={t('columns.menu.copyName')}>
					<Input value={copyTitle} onChange={(event) => setCopyTitle(event.target.value)} maxLength={60} autoFocus />
				</Field>
				<p className='bc-menu__hint'>{t('columns.menu.copyHint', { count: column.tasks.length })}</p>
				<Button type='submit' block disabled={!copyTitle.trim()}>{t('columns.menu.copySubmit')}</Button>
			</form>
		)
	} else if (view === 'move') {
		content = (
			<form className='bc-menu__form' onSubmit={(event) => { event.preventDefault(); run('move', position) }}>
				<Field label={t('columns.menu.position')}>
					<Select value={position} onChange={(event) => setPosition(Number(event.target.value))} options={columns.map((item, index) => ({ value: index, label: index === columns.indexOf(column) ? t('columns.menu.current', { number: index + 1 }) : String(index + 1) }))} />
				</Field>
				<Button type='submit' block>{t('columns.menu.moveSubmit')}</Button>
			</form>
		)
	} else if (view === 'moveCards') {
		content = otherColumns.length ? (
			<div className='bc-menu__list'>
				<p className='bc-menu__hint'>{t('columns.menu.moveCardsHint', { count: column.tasks.length })}</p>
				{otherColumns.map((item) => (
					<Item key={item._id} onClick={() => run('moveCards', item._id)} disabled={!column.tasks.length}>
						<span data-i18n-ignore>{item.title}</span>
					</Item>
				))}
			</div>
		) : <p className='bc-menu__hint'>{t('columns.menu.noOtherLists')}</p>
	} else if (view === 'sort') {
		content = (
			<div className='bc-menu__list' role='group' aria-label={t('columns.menu.sort')}>
				{SORT_OPTIONS.map((option) => (
					<Item key={option} checked={(column.sortBy || 'custom') === option} onClick={() => run('sort', option)}>{t(`columns.sort.${option}`)}</Item>
				))}
			</div>
		)
	} else {
		content = (
			<>
				<div className='bc-menu__list'>
					<Item onClick={() => run('addCard')}>{t('columns.menu.addCard')}</Item>
					{canManage && <Item onClick={() => setView('copy')}>{t('columns.menu.copy')}</Item>}
					{canManage && <Item onClick={() => setView('move')}>{t('columns.menu.move')}</Item>}
					{canManage && <Item onClick={() => setView('moveCards')}>{t('columns.menu.moveCards')}</Item>}
					<Item onClick={() => setView('sort')}>{t('columns.menu.sort')}</Item>
					<Item checked={isWatching} onClick={() => run('watch', !isWatching)}>{t('columns.menu.watch')}</Item>
					{canManage && <Item onClick={() => run('pin', !column.pinned)}>{column.pinned ? t('columns.menu.unpin') : t('columns.menu.pin')}</Item>}
					{!isPhone && <Item onClick={() => run('collapse', !isCollapsed)}>{isCollapsed ? t('columns.menu.expand') : t('columns.menu.collapse')}</Item>}
				</div>
				{canManage && (
					<>
						<hr className='bc-menu__divider' />
						<p className='bc-menu__section'>{t('columns.menu.color')}</p>
						<div className='bc-colors' role='group' aria-label={t('columns.menu.color')}>
							{COLUMN_COLOR_KEYS.map((key) => (
								<button
									key={key}
									type='button'
									className={cx('bc-colors__swatch', column.color === key && 'is-selected')}
									style={{ '--swatch': COLUMN_COLORS[key] }}
									onClick={() => run('color', key)}
									aria-pressed={column.color === key}
									aria-label={t(`columns.colors.${key}`)}
									title={t(`columns.colors.${key}`)}
								>
									{column.color === key && <Check size={16} aria-hidden='true' />}
								</button>
							))}
						</div>
						<Button variant='secondary' size='sm' block icon={X} onClick={() => run('color', null)} disabled={!column.color}>{t('columns.menu.removeColor')}</Button>
						<hr className='bc-menu__divider' />
						<div className='bc-menu__list'>
							<Item tone='danger' onClick={() => run('delete')}>{t('columns.menu.delete')}</Item>
						</div>
					</>
				)}
			</>
		)
	}

	const back = view === 'main' ? null : () => setView('main')
	if (isPhone) {
		return (
			<Modal open onClose={onClose} onBack={back || undefined} title={titles[view]} className='bc-sheet'>
				<div className='bc-menu'>{content}</div>
			</Modal>
		)
	}
	return (
		<AnchoredPanel anchor={anchor} label={titles[view]} onClose={onClose} onEscape={back || onClose}>
			<div className='bc-menu'>
				<header className='bc-menu__header'>
					{back ? <IconButton icon={ArrowLeft} size='sm' label={t('common.back')} onClick={back} /> : <span className='bc-menu__spacer' />}
					<h3 className='bc-menu__title'>{titles[view]}</h3>
					<IconButton icon={X} size='sm' label={t('common.close')} onClick={onClose} />
				</header>
				{content}
			</div>
		</AnchoredPanel>
	)
}

export default ColumnActions
