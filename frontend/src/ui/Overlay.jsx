import { ArrowLeft, Check, ChevronDown, X } from 'lucide-react'
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../i18n'
import { Button, IconButton } from './Button'
import { cx } from './utils'
import { Field, Input } from './Form'
import { isTextEntry, isTouchScreen } from '../utils/autoFocus'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

let openModals = 0
// Open dialogs, newest last: only the top one answers Escape and Tab.
const modalStack = []

/**
 * Dialog with focus trap, Escape to close, background scroll lock and focus
 * restore. On phones it is shown as a bottom sheet (see ui.css).
 */
export const Modal = ({ open, onClose, onBack, title, description, size = 'md', variant = 'dialog', footer, children, initialFocusRef, closeOnBackdrop = true, className, label, headerStart, headerActions }) => {
	const { t } = useI18n()
	const panelRef = useRef(null)
	const titleId = useId()
	const descriptionId = useId()
	const onCloseRef = useRef(onClose)
	const onBackRef = useRef(onBack)
	useEffect(() => {
		onCloseRef.current = onClose
		onBackRef.current = onBack
	})

	useEffect(() => {
		if (!open) return undefined
		const previouslyFocused = document.activeElement
		openModals += 1
		const token = {}
		modalStack.push(token)
		document.body.style.overflow = 'hidden'
		// Lets fixed page chrome (the phone bottom bar) step aside while a dialog is open.
		document.body.classList.add('has-modal')
		const firstTarget = initialFocusRef?.current || panelRef.current?.querySelector(FOCUSABLE) || panelRef.current
		// On touch screens a text field waits for a tap: focusing it would pop the keyboard over the sheet.
		const focusTarget = isTouchScreen() && isTextEntry(firstTarget) ? panelRef.current : firstTarget
		focusTarget?.focus({ preventScroll: true })

		const handleKeyDown = (event) => {
			if (modalStack.at(-1) !== token) return
			if (event.key === 'Escape') {
				event.stopPropagation()
				// A sub-view steps back first; the dialog closes from its main view.
				if (onBackRef.current) onBackRef.current()
				else onCloseRef.current?.()
				return
			}
			if (event.key !== 'Tab' || !panelRef.current) return
			const focusable = [...panelRef.current.querySelectorAll(FOCUSABLE)].filter((element) => element.offsetParent !== null)
			if (!focusable.length) return
			const first = focusable[0]
			const last = focusable[focusable.length - 1]
			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault()
				last.focus()
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault()
				first.focus()
			}
		}
		document.addEventListener('keydown', handleKeyDown)
		return () => {
			document.removeEventListener('keydown', handleKeyDown)
			modalStack.splice(modalStack.indexOf(token), 1)
			openModals -= 1
			if (openModals === 0) {
				document.body.style.overflow = ''
				document.body.classList.remove('has-modal')
			}
			if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus({ preventScroll: true })
		}
	}, [open, initialFocusRef])

	if (!open) return null
	return createPortal(
		<div
			className={cx('ui-overlay', variant === 'panel' && 'ui-overlay--panel')}
			role='presentation'
			onMouseDown={(event) => {
				if (closeOnBackdrop && event.target === event.currentTarget) onClose?.()
			}}
		>
			<section
				ref={panelRef}
				className={cx('ui-modal', size !== 'md' && `ui-modal--${size}`, variant === 'panel' && 'ui-modal--panel', className)}
				role='dialog'
				aria-modal='true'
				aria-labelledby={title ? titleId : undefined}
				aria-label={!title ? label : undefined}
				aria-describedby={description ? descriptionId : undefined}
				tabIndex={-1}
			>
				<span className='ui-modal__grabber' aria-hidden='true' />
				{(title || onClose || headerStart) && (
					<header className='ui-modal__header'>
						{onBack && <IconButton icon={ArrowLeft} label={t('common.back')} onClick={onBack} className='ui-modal__back' />}
						<div className='ui-modal__heading'>
							{headerStart}
							{title && <h2 className='ui-modal__title' id={titleId}>{title}</h2>}
							{description && <p className='ui-modal__description' id={descriptionId}>{description}</p>}
						</div>
						{headerActions}
						{onClose && <IconButton icon={X} label={t('common.close')} onClick={onClose} />}
					</header>
				)}
				<div className='ui-modal__body'>{children}</div>
				{footer && <footer className='ui-modal__footer'>{footer}</footer>}
			</section>
		</div>,
		document.body,
	)
}

/**
 * Confirmation for destructive or important actions. With `confirmText` the user
 * must type that phrase first (used for deleting a room or transferring ownership).
 */
export const ConfirmDialog = ({
	open,
	onClose,
	onConfirm,
	title,
	description,
	confirmLabel,
	cancelLabel,
	tone = 'danger',
	confirmText,
	loading = false,
	initialFocusRef,
	children,
}) => {
	const { t } = useI18n()
	const [typed, setTyped] = useState('')
	const [wasOpen, setWasOpen] = useState(open)
	if (wasOpen !== open) {
		setWasOpen(open)
		if (open) setTyped('')
	}
	const isArmed = !confirmText || typed.trim().toLowerCase() === confirmText.toLowerCase()
	return (
		<Modal
			open={open}
			onClose={loading ? undefined : onClose}
			title={title}
			description={description}
			size='sm'
			initialFocusRef={initialFocusRef}
			footer={
				<>
					<Button variant='secondary' onClick={onClose} disabled={loading}>{cancelLabel || t('common.cancel')}</Button>
					<Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} disabled={!isArmed} loading={loading}>
						{confirmLabel || t('common.confirm')}
					</Button>
				</>
			}
		>
			{children}
			{confirmText && (
				<form onSubmit={(event) => { event.preventDefault(); if (isArmed && !loading) onConfirm() }}>
					<Field label={t('common.typeToConfirm', { phrase: confirmText })}>
						<Input value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete='off' placeholder={confirmText} />
					</Field>
				</form>
			)}
		</Modal>
	)
}

/**
 * Dropdown menu. `trigger` receives props to spread on the opening button;
 * items are `{ label, icon, onSelect, tone, href, checked, lang, separator, heading }`.
 */
export const Menu = ({ trigger, items, align = 'end', label }) => {
	const [open, setOpen] = useState(false)
	const [position, setPosition] = useState(null)
	const [openGroup, setOpenGroup] = useState(null)
	const triggerRef = useRef(null)
	const menuRef = useRef(null)
	const menuId = useId()

	const close = useCallback((restoreFocus = true) => {
		setOpen(false)
		setOpenGroup(null)
		if (restoreFocus) triggerRef.current?.focus({ preventScroll: true })
	}, [])

	useLayoutEffect(() => {
		if (!open || !triggerRef.current || !menuRef.current) return
		const rect = triggerRef.current.getBoundingClientRect()
		const menu = menuRef.current.getBoundingClientRect()
		const margin = 8
		let left = align === 'end' ? rect.right - menu.width : rect.left
		left = Math.min(Math.max(margin, left), window.innerWidth - menu.width - margin)
		const below = rect.bottom + 6
		const top = below + menu.height > window.innerHeight - margin ? Math.max(margin, rect.top - menu.height - 6) : below
		setPosition({ top, left })
	}, [open, align, openGroup])

	useEffect(() => {
		if (!open) return undefined
		menuRef.current?.querySelector('.ui-menu__item')?.focus({ preventScroll: true })
		const handlePointerDown = (event) => {
			if (!menuRef.current?.contains(event.target) && !triggerRef.current?.contains(event.target)) close(false)
		}
		const handleKeyDown = (event) => {
			const itemsInMenu = [...(menuRef.current?.querySelectorAll('.ui-menu__item') || [])]
			const index = itemsInMenu.indexOf(document.activeElement)
			if (event.key === 'Escape') {
				event.stopPropagation()
				close()
			} else if (event.key === 'ArrowDown') {
				event.preventDefault()
				itemsInMenu[(index + 1) % itemsInMenu.length]?.focus()
			} else if (event.key === 'ArrowUp') {
				event.preventDefault()
				itemsInMenu[(index - 1 + itemsInMenu.length) % itemsInMenu.length]?.focus()
			} else if (event.key === 'Tab') {
				close(false)
			}
		}
		const handleViewportChange = () => close(false)
		document.addEventListener('pointerdown', handlePointerDown)
		document.addEventListener('keydown', handleKeyDown, true)
		window.addEventListener('resize', handleViewportChange)
		window.addEventListener('scroll', handleViewportChange, true)
		return () => {
			document.removeEventListener('pointerdown', handlePointerDown)
			document.removeEventListener('keydown', handleKeyDown, true)
			window.removeEventListener('resize', handleViewportChange)
			window.removeEventListener('scroll', handleViewportChange, true)
		}
	}, [open, close])

	const renderItem = (item) => {
		const Icon = item.icon
		const content = (
			<>
				{Icon && <Icon size={17} aria-hidden='true' />}
				<span lang={item.lang}>{item.label}</span>
				{item.mark === 'end' && item.checked && <Check size={16} className='ui-menu__check' aria-hidden='true' />}
			</>
		)
		// Items with `checked` form a single-choice group (theme, language).
		const role = item.checked === undefined ? 'menuitem' : 'menuitemradio'
		const className = cx('ui-menu__item', item.tone === 'danger' && 'ui-menu__item--danger')
		return item.href ? (
			<a key={item.label} href={item.href} role={role} aria-checked={item.checked} className={className} onClick={() => close(false)}>
				{content}
			</a>
		) : (
			<button
				key={item.label}
				type='button'
				role={role}
				aria-checked={item.checked}
				className={className}
				disabled={item.disabled}
				onClick={() => {
					// Return focus to the trigger so keyboard users keep their place.
					close()
					item.onSelect?.()
				}}
			>
				{content}
			</button>
		)
	}

	return (
		<>
			{trigger({
				ref: triggerRef,
				'aria-haspopup': 'menu',
				'aria-expanded': open,
				'aria-controls': open ? menuId : undefined,
				onClick: () => setOpen((value) => !value),
			})}
			{open &&
				createPortal(
					<div
						ref={menuRef}
						id={menuId}
						className='ui-menu'
						role='menu'
						aria-label={label}
						style={position ? { top: position.top, left: position.left } : { top: -9999, left: -9999 }}
					>
						{items.filter(Boolean).map((item, index) => {
							if (item.separator) return <div key={`separator-${index}`} className='ui-menu__separator' role='separator' />
							if (item.heading) return <div key={`heading-${index}`} className='ui-menu__label'>{item.heading}</div>
							// A non-interactive header, e.g. who is signed in.
							if (item.header) {
								return (
									<div key={`header-${index}`} className={cx('ui-menu__header', item.header.avatar && 'ui-menu__header--person')} data-i18n-ignore>
										{item.header.avatar}
										<span className='ui-menu__header-text'>
											<span className='ui-menu__header-title'>{item.header.title}</span>
											{item.header.subtitle && <span className='ui-menu__header-subtitle'>{item.header.subtitle}</span>}
											{item.header.meta && <span className='ui-menu__header-meta'>{item.header.meta}</span>}
										</span>
									</div>
								)
							}
							// A group shows its current value and opens its choices in place (theme, language).
							if (item.group) {
								const groupKey = item.group.id || item.group.label
								const expanded = openGroup === groupKey
								const GroupIcon = item.group.icon
								return (
									<div key={`group-${groupKey}`} className={cx('ui-menu__group', expanded && 'is-open')}>
										<button
											type='button'
											role='menuitem'
											aria-haspopup='true'
											aria-expanded={expanded}
											className='ui-menu__item ui-menu__group-toggle'
											onClick={() => setOpenGroup(expanded ? null : groupKey)}
										>
											{GroupIcon && <GroupIcon size={17} aria-hidden='true' />}
											<span>{item.group.label}</span>
											<span className='ui-menu__value' lang={item.group.valueLang}>{item.group.value}</span>
											<ChevronDown size={15} className='ui-menu__chevron' aria-hidden='true' />
										</button>
										{expanded && (
											<div role='group' aria-label={item.group.label} className='ui-menu__sub'>
												{item.group.items.map((subItem) => renderItem(subItem))}
											</div>
										)}
									</div>
								)
							}
							return renderItem(item)
						})}
					</div>,
					document.body,
				)}
		</>
	)
}
