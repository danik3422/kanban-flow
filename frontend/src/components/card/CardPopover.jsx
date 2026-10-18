import { ArrowLeft, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import useIsPhone from '../../hooks/useIsPhone'
import { useI18n } from '../../i18n'
import { IconButton, Modal } from '../../ui'
import { isTextEntry, isTouchScreen } from '../../utils/autoFocus'

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'

/**
 * A small panel for one choice on a card (labels, dates, members…): next to the
 * button that opened it on wide screens, a bottom sheet on phones. Escape and a
 * click outside close it (Escape steps back first when there is a back step).
 */
const CardPopover = ({ open, anchor, onClose, onBack, title, children, width = 304 }) => {
	const { t } = useI18n()
	const isPhone = useIsPhone()
	const panelRef = useRef(null)
	const [position, setPosition] = useState(null)

	useLayoutEffect(() => {
		if (!open || isPhone || !panelRef.current) return
		const place = () => {
			const panel = panelRef.current.getBoundingClientRect()
			// Without its button (it may be gone), the panel sits in the middle.
			const box = anchor?.isConnected ? anchor.getBoundingClientRect() : { left: (window.innerWidth - panel.width) / 2, top: window.innerHeight / 3, bottom: window.innerHeight / 3 }
			const margin = 8
			const left = Math.min(Math.max(margin, box.left), window.innerWidth - panel.width - margin)
			const below = box.bottom + 6
			const top = below + panel.height > window.innerHeight - margin ? Math.max(margin, Math.min(box.top - panel.height - 6, window.innerHeight - panel.height - margin)) : below
			setPosition({ top, left })
		}
		place()
		const observer = new ResizeObserver(place)
		observer.observe(panelRef.current)
		window.addEventListener('resize', place)
		return () => {
			observer.disconnect()
			window.removeEventListener('resize', place)
		}
	}, [open, isPhone, anchor])

	useEffect(() => {
		if (!open || isPhone) return undefined
		const first = panelRef.current?.querySelector(FOCUSABLE)
		if (first && !(isTouchScreen() && isTextEntry(first))) first.focus({ preventScroll: true })
		const onKey = (event) => {
			if (event.key !== 'Escape') return
			event.stopPropagation()
			event.preventDefault()
			if (onBack) onBack()
			else onClose()
		}
		const onDown = (event) => {
			if (!panelRef.current?.contains(event.target) && !anchor?.contains(event.target) && !event.target.closest?.('.ui-menu')) onClose()
		}
		document.addEventListener('keydown', onKey, true)
		document.addEventListener('pointerdown', onDown, true)
		return () => {
			document.removeEventListener('keydown', onKey, true)
			document.removeEventListener('pointerdown', onDown, true)
			if (anchor?.isConnected) anchor.focus({ preventScroll: true })
		}
	}, [open, isPhone, onClose, onBack, anchor])

	if (!open) return null
	if (isPhone) {
		return (
			<Modal open={open} onClose={onClose} onBack={onBack} title={title} size='sm' className='cp-sheet'>
				{children}
			</Modal>
		)
	}
	return createPortal(
		<section
			ref={panelRef}
			className='cp'
			role='dialog'
			aria-label={title}
			style={{ width, ...(position || { top: -9999, left: -9999 }) }}
		>
			<header className='cp__header'>
				{onBack ? <IconButton icon={ArrowLeft} size='sm' label={t('common.back')} onClick={onBack} /> : <span className='cp__spacer' />}
				<h3 className='cp__title'>{title}</h3>
				<IconButton icon={X} size='sm' label={t('common.close')} onClick={onClose} />
			</header>
			<div className='cp__body'>{children}</div>
		</section>,
		document.body,
	)
}

export default CardPopover
