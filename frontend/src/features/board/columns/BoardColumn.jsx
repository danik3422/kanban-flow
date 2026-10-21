import { ChevronsLeftRight, ChevronsRightLeft, Eye, MoreHorizontal, Pin, Plus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../../i18n'
import { Button, IconButton } from '../../../ui'
import { cx } from '../../../ui/utils'
import { COLUMN_COLORS } from '../model/columnColors'

// A textarea that grows with its text, for list and card titles.
const AutoTextarea = ({ value, onChange, ...props }) => {
	const ref = useRef(null)
	useEffect(() => {
		const element = ref.current
		if (!element) return
		element.style.height = 'auto'
		element.style.height = `${element.scrollHeight}px`
	}, [value])
	return <textarea ref={ref} rows={1} value={value} onChange={onChange} {...props} />
}

/** "Add a card" at the bottom of a list; stays open so several cards go in a row. */
export const CardComposer = ({ isOpen, onOpen, onClose, onSubmit, label }) => {
	const { t } = useI18n()
	const [title, setTitle] = useState('')
	const [isSaving, setIsSaving] = useState(false)
	const formRef = useRef(null)

	const submit = async () => {
		const value = title.trim()
		if (!value || isSaving) return
		setIsSaving(true)
		const ok = await onSubmit(value)
		setIsSaving(false)
		if (ok !== false) setTitle('')
	}

	if (!isOpen) {
		return (
			<button type='button' className='bc-add-card' onClick={onOpen}>
				<Plus size={16} aria-hidden='true' /> {t('columns.addCard')}
			</button>
		)
	}
	return (
		<form
			ref={formRef}
			className='bc-composer'
			onSubmit={(event) => {
				event.preventDefault()
				submit()
			}}
			onBlur={(event) => {
				if (!formRef.current?.contains(event.relatedTarget) && !title.trim()) onClose()
			}}
		>
			<AutoTextarea
				className='bc-composer__input'
				value={title}
				onChange={(event) => setTitle(event.target.value.replace(/\n/g, ''))}
				onKeyDown={(event) => {
					if (event.key === 'Enter') {
						event.preventDefault()
						submit()
					} else if (event.key === 'Escape') {
						event.stopPropagation()
						onClose()
					}
				}}
				placeholder={t('columns.cardPlaceholder')}
				aria-label={label}
				maxLength={200}
				autoFocus
			/>
			<div className='bc-composer__actions'>
				<Button type='submit' size='sm' loading={isSaving} disabled={!title.trim()}>{t('columns.addCardSubmit')}</Button>
				<IconButton icon={X} size='sm' label={t('common.cancel')} onClick={onClose} />
			</div>
		</form>
	)
}

/** "Add another list" after the last list. Enter adds and keeps it open for the next one. */
export const ListComposer = ({ onSubmit }) => {
	const { t } = useI18n()
	const [isOpen, setIsOpen] = useState(false)
	const [title, setTitle] = useState('')
	const [isSaving, setIsSaving] = useState(false)

	const submit = async (event) => {
		event.preventDefault()
		const value = title.trim()
		if (!value || isSaving) return
		setIsSaving(true)
		const ok = await onSubmit(value)
		setIsSaving(false)
		if (ok !== false) setTitle('')
	}

	if (!isOpen) {
		return (
			<button type='button' className='bc-add-list' onClick={() => setIsOpen(true)}>
				<Plus size={18} aria-hidden='true' /> {t('columns.addList')}
			</button>
		)
	}
	return (
		<form className='bc-column bc-list-composer' onSubmit={submit}>
			<input
				className='bc-composer__input'
				value={title}
				onChange={(event) => setTitle(event.target.value)}
				onKeyDown={(event) => {
					if (event.key === 'Escape') {
						event.stopPropagation()
						setIsOpen(false)
						setTitle('')
					}
				}}
				placeholder={t('columns.listPlaceholder')}
				aria-label={t('columns.listName')}
				maxLength={60}
				autoFocus
			/>
			<div className='bc-composer__actions'>
				<Button type='submit' size='sm' loading={isSaving} disabled={!title.trim()}>{t('columns.addListSubmit')}</Button>
				<IconButton icon={X} size='sm' label={t('common.cancel')} onClick={() => { setIsOpen(false); setTitle('') }} />
			</div>
		</form>
	)
}

/**
 * One list: a header you can rename in place, fold away or open actions from,
 * its cards, and a composer for new cards. Folded, it becomes a slim strip.
 */
const BoardColumn = ({
	column,
	canManage,
	isCollapsed,
	isWatching,
	isDragging,
	isDropTarget,
	isTaskDragActive,
	isComposing,
	onStartComposing,
	onStopComposing,
	onAddCard,
	onRename,
	onToggleCollapse,
	onOpenMenu,
	onHeaderPointerDown,
	children,
}) => {
	const { t } = useI18n()
	const [isEditing, setIsEditing] = useState(false)
	const [title, setTitle] = useState(column.title)
	const menuButtonRef = useRef(null)
	const count = column.tasks.length
	const tint = column.color ? COLUMN_COLORS[column.color] : null

	const startEditing = () => {
		if (!canManage) return
		setTitle(column.title)
		setIsEditing(true)
	}
	const finishEditing = async (save) => {
		setIsEditing(false)
		const value = title.trim()
		if (save && value && value !== column.title) await onRename(value)
	}

	const shared = {
		'data-column-id': column._id,
		'data-color': column.color || undefined,
		style: tint ? { '--bc-tint': tint } : undefined,
	}

	if (isCollapsed) {
		return (
			<section
				{...shared}
				className={cx('bc-column bc-column--collapsed', isDropTarget && 'is-drop-target', isTaskDragActive && 'is-drop-ready')}
				aria-label={t('columns.collapsedLabel', { title: column.title, count })}
			>
				<button type='button' className='bc-collapsed' onClick={onToggleCollapse} title={t('columns.expand')}>
					<ChevronsLeftRight size={16} aria-hidden='true' />
					<span className='bc-collapsed__title' data-i18n-ignore>{column.title}</span>
					<span className='bc-collapsed__count'>{count}</span>
					<span className='ui-visually-hidden'>{t('columns.expand')}</span>
				</button>
			</section>
		)
	}

	return (
		<section
			{...shared}
			className={cx('bc-column', isDragging && 'is-dragging', isDropTarget && 'is-drop-target', isTaskDragActive && 'is-drop-ready', column.pinned && 'is-pinned')}
			aria-labelledby={`bc-title-${column._id}`}
		>
			<header className='bc-column__header' onPointerDown={(event) => !isEditing && onHeaderPointerDown?.(event)}>
				{isEditing ? (
					<AutoTextarea
						className='bc-column__title-input'
						value={title}
						onChange={(event) => setTitle(event.target.value.replace(/\n/g, ''))}
						onFocus={(event) => event.target.select()}
						onBlur={() => finishEditing(true)}
						onKeyDown={(event) => {
							if (event.key === 'Enter') {
								event.preventDefault()
								finishEditing(true)
							} else if (event.key === 'Escape') {
								event.stopPropagation()
								finishEditing(false)
							}
						}}
						aria-label={t('columns.rename')}
						maxLength={60}
						autoFocus
					/>
				) : (
					<h2 className='bc-column__title' id={`bc-title-${column._id}`}>
						{canManage ? (
							<button type='button' className='bc-column__title-button' onClick={startEditing} title={t('columns.renameHint')} data-i18n-ignore>{column.title}</button>
						) : <span data-i18n-ignore>{column.title}</span>}
					</h2>
				)}
				<span className='bc-column__meta'>
					{column.pinned && <Pin size={13} className='bc-column__pin' aria-label={t('columns.pinned')} />}
					{isWatching && <Eye size={14} className='bc-column__watch' aria-label={t('columns.watching')} />}
					<span className='bc-column__count' aria-label={t('columns.count', { count })}>{count}</span>
				</span>
				<IconButton className='bc-column__collapse' icon={ChevronsRightLeft} size='sm' label={t('columns.collapse')} onClick={onToggleCollapse} />
				<IconButton ref={menuButtonRef} icon={MoreHorizontal} size='sm' label={t('columns.actions', { title: column.title })} onClick={() => onOpenMenu(menuButtonRef.current)} />
			</header>
			<div className='bc-tasks'>{children}</div>
			<footer className='bc-column__footer'>
				<CardComposer isOpen={isComposing} onOpen={onStartComposing} onClose={onStopComposing} onSubmit={onAddCard} label={t('columns.cardIn', { title: column.title })} />
			</footer>
		</section>
	)
}

export default BoardColumn
