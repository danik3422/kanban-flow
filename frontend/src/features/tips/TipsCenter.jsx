import { ArrowRight, Hand, Lightbulb, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { FaGithub } from 'react-icons/fa'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import useIsPhone from '../../hooks/useIsPhone'
import { useI18n } from '../../i18n'
import { Button, IconButton, Modal } from '../../ui'
import { cx } from '../../ui/utils'
import { GITHUB_URL, ISSUES_URL } from '../site/links'
import { hasSwiped, hasUnseen, markSeen, markSwiped, startIndex, tipsFor } from './tips'
import './tips.css'

const onBoardPage = (pathname) => /^\/workspaces\/[^/]+/.test(pathname)

/** A drawing for each tip: its icon on a coloured panel with a few floating cards. */
const TipArt = ({ tip }) => {
	const Icon = tip.icon
	return (
		<div className={cx('tip-art', `tip-art--${tip.tone}`)} aria-hidden='true'>
			<span className='tip-art__glow' />
			<span className='tip-art__card tip-art__card--one'><i /><i /></span>
			<span className='tip-art__card tip-art__card--two'><i /><i /><i /></span>
			<span className='tip-art__card tip-art__card--three'><i /></span>
			<span className='tip-art__icon'><Icon size={30} strokeWidth={1.8} /></span>
		</div>
	)
}

/**
 * Tips under the light bulb beside the notifications, like Trello's: one feature at a
 * time with a button that shows it, a way to the next tip, and links about the project.
 * A dot marks tips not seen yet. Phones open it from the account menu as a sheet.
 */
const TipsCenter = () => {
	const { t } = useI18n()
	const isPhone = useIsPhone()
	const navigate = useNavigate()
	const { pathname } = useLocation()
	const [isOpen, setIsOpen] = useState(false)
	// Phones skip the keyboard-only tips.
	const tips = tipsFor(isPhone)
	const [index, setIndex] = useState(() => startIndex(tips))
	const [unseen, setUnseen] = useState(() => hasUnseen(tips))
	const [swiped, setSwiped] = useState(hasSwiped)
	const slideRef = useRef(null)
	const gesture = useRef(null) // the finger or mouse moving the tip right now
	const entering = useRef(null) // { from: 1 | -1, distance } for the tip about to appear
	const leaving = useRef(false)
	const wrapperRef = useRef(null)
	const triggerRef = useRef(null)
	const current = Math.min(index, tips.length - 1)
	const tip = tips[current]
	const onBoard = onBoardPage(pathname)
	const action = tip.action && (!tip.action.boardView && !tip.action.board ? tip.action : onBoard ? tip.action : null)

	const open = () => {
		const next = startIndex(tips)
		setIndex(next)
		markSeen(tips[next].key)
		setUnseen(hasUnseen(tips))
		setIsOpen(true)
	}
	const close = (restoreFocus = true) => {
		setIsOpen(false)
		if (restoreFocus && !isPhone) triggerRef.current?.focus({ preventScroll: true })
	}
	// `from`: 1 when the new tip comes in from the right (next), -1 from the left (previous).
	const show = (next, from = next > current ? 1 : -1, distance = 28) => {
		const wrapped = (next + tips.length) % tips.length
		if (wrapped === current) return
		entering.current = { from, distance }
		setIndex(wrapped)
		markSeen(tips[wrapped].key)
		setUnseen(hasUnseen(tips))
	}
	const run = () => {
		close(false)
		if (action.boardView) window.dispatchEvent(new CustomEvent('kh:board-view', { detail: action.boardView }))
		else if (action.event) window.dispatchEvent(new CustomEvent(action.event))
		else if (action.to) navigate(action.to, action.state ? { state: action.state } : undefined)
	}

	// The account menu on phones opens the tips with this event.
	useEffect(() => {
		const handleOpen = () => open()
		window.addEventListener('kh:tips', handleOpen)
		return () => window.removeEventListener('kh:tips', handleOpen)
	})

	useEffect(() => {
		if (!isOpen || isPhone) return undefined
		const handlePointerDown = (event) => {
			if (!wrapperRef.current?.contains(event.target)) setIsOpen(false)
		}
		const handleKeyDown = (event) => {
			if (event.key === 'Escape') {
				event.stopPropagation()
				close()
			} else if ((event.key === 'ArrowRight' || event.key === 'ArrowLeft') && wrapperRef.current?.contains(document.activeElement)) {
				event.preventDefault()
				show(current + (event.key === 'ArrowRight' ? 1 : -1), event.key === 'ArrowRight' ? 1 : -1)
			}
		}
		document.addEventListener('pointerdown', handlePointerDown)
		document.addEventListener('keydown', handleKeyDown)
		return () => {
			document.removeEventListener('pointerdown', handlePointerDown)
			document.removeEventListener('keydown', handleKeyDown)
		}
	})

	// The tip follows the finger while it is swiped; it is moved straight on the element,
	// outside React, so nothing re-renders mid-gesture and the motion stays smooth.
	const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
	const place = (x, duration = 0) => {
		const element = slideRef.current
		if (!element) return
		const width = element.offsetWidth || 1
		element.style.transition = duration ? `transform ${duration}ms cubic-bezier(0.2, 0, 0, 1), opacity ${duration}ms ease` : 'none'
		element.style.transform = x ? `translate3d(${x}px, 0, 0)` : ''
		element.style.opacity = x ? String(Math.max(0.25, 1 - Math.abs(x) / (width * 1.1))) : ''
	}

	// A new tip slides in from the side it comes from.
	useLayoutEffect(() => {
		const enter = entering.current
		entering.current = null
		if (!enter || reduceMotion()) {
			place(0)
			return
		}
		place(enter.from * enter.distance)
		if (slideRef.current) slideRef.current.style.opacity = '0'
		void slideRef.current?.offsetWidth
		place(0, 240)
	}, [index])

	const swipeHandlers = {
		onPointerDown: (event) => {
			if (leaving.current || (event.pointerType === 'mouse' && event.button !== 0)) return
			gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, axis: null, dx: 0, samples: [{ x: event.clientX, t: event.timeStamp }] }
		},
		onPointerMove: (event) => {
			const drag = gesture.current
			if (!drag || drag.id !== event.pointerId) return
			const dx = event.clientX - drag.x
			const dy = event.clientY - drag.y
			if (!drag.axis) {
				// Decide the direction once the pointer has moved a little: up and down scrolls the sheet.
				if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return
				drag.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
				if (drag.axis === 'x') event.currentTarget.setPointerCapture?.(event.pointerId)
			}
			if (drag.axis !== 'x') return
			drag.dx = dx
			drag.samples = [...drag.samples.filter((sample) => event.timeStamp - sample.t < 100), { x: event.clientX, t: event.timeStamp }]
			cancelAnimationFrame(drag.frame)
			drag.frame = requestAnimationFrame(() => place(dx))
		},
		onPointerUp: (event) => finishSwipe(event, false),
		onPointerCancel: (event) => finishSwipe(event, true),
	}
	const finishSwipe = (event, cancelled) => {
		const drag = gesture.current
		gesture.current = null
		if (!drag || drag.id !== event.pointerId || drag.axis !== 'x') return
		cancelAnimationFrame(drag.frame)
		const width = slideRef.current?.offsetWidth || 320
		const first = drag.samples[0]
		const velocity = (event.clientX - first.x) / Math.max(1, event.timeStamp - first.t) // px per ms
		const forward = drag.dx < 0
		const flung = Math.abs(velocity) > 0.45 && Math.sign(velocity) === Math.sign(drag.dx)
		if (cancelled || !(Math.abs(drag.dx) > width * 0.22 || flung)) {
			place(0, 220)
			return
		}
		const from = forward ? 1 : -1
		if (reduceMotion()) {
			show(current + from, from)
			return
		}
		if (!swiped) {
			markSwiped()
			setSwiped(true)
		}
		leaving.current = true
		place(-from * width, 170)
		window.setTimeout(() => {
			leaving.current = false
			show(current + from, from, width * 0.35)
		}, 170)
	}

	const body = (
		<div className='tips'>
			<div ref={slideRef} className='tips__slide' {...swipeHandlers}>
				<TipArt tip={tip} />
				{/* Every tip's text sits in the same spot, only the current one visible, so the
				    panel is as tall as the longest tip and never jumps while swiping. */}
				<div className='tips__texts'>
					{tips.map((item, position) => (
						<div key={item.key} className={cx('tips__text', position === current && 'is-active')} aria-hidden={position !== current} aria-live={position === current ? 'polite' : undefined}>
							<p className='tips__eyebrow'>{t('tips.eyebrow', { index: position + 1, total: tips.length })}</p>
							<h3 className='tips__title'>{t(`tips.items.${item.key}.${isPhone && item.phoneTitle ? 'titlePhone' : 'title'}`)}</h3>
							<p className='tips__body'>{t(`tips.items.${item.key}.${isPhone && item.phoneText ? 'textPhone' : 'text'}`)}</p>
						</div>
					))}
				</div>
			</div>
			<div className='tips__actions'>
				<Button size='sm' variant='ghost' onClick={() => show(current + 1, 1)} className='tips__next'>{isPhone ? t('tips.nextShort') : t('tips.next')}</Button>
				{action && <Button size='sm' iconRight={ArrowRight} onClick={run} className='tips__go'>{t(`tips.items.${tip.key}.action`)}</Button>}
			</div>
			<div className='tips__dots' role='tablist' aria-label={t('tips.label')}>
				{tips.map((item, dot) => (
					<button key={item.key} type='button' role='tab' aria-selected={dot === current} aria-label={t(`tips.items.${item.key}.title`)} className={cx('tips__dot', dot === current && 'is-active')} onClick={() => show(dot)} />
				))}
			</div>
			{isPhone && !swiped && <p className='tips__hint'><Hand size={14} aria-hidden='true' />{t('tips.swipeHint')}</p>}
			<nav className='tips__links' aria-label={t('tips.links')}>
				<Link to='/about' onClick={() => close(false)}>{t('tips.about')}</Link>
				<Link to='/self-hosting' onClick={() => close(false)}>{t('tips.selfHost')}</Link>
				{onBoard && !isPhone && <button type='button' onClick={() => { close(false); window.dispatchEvent(new CustomEvent('kh:shortcuts')) }}>{t('tips.shortcuts')}</button>}
				<a href={ISSUES_URL} target='_blank' rel='noreferrer'>{t('tips.report')}</a>
				<a href={GITHUB_URL} target='_blank' rel='noreferrer' className='tips__github'><FaGithub size={14} aria-hidden='true' />GitHub</a>
			</nav>
		</div>
	)

	const trigger = (
		<button
			ref={triggerRef}
			type='button'
			className='tips-trigger'
			onClick={() => (isOpen ? close() : open())}
			aria-label={unseen ? t('tips.labelNew') : t('tips.label')}
			title={t('tips.label')}
			aria-expanded={isOpen}
			aria-haspopup='dialog'
		>
			<Lightbulb size={18} aria-hidden='true' />
			{unseen && <span className='tips-trigger__dot' aria-hidden='true' />}
		</button>
	)

	// Phones: the light bulb shows where the top bar has room (not on a board, where the
	// tips are in the account menu), and the tips open as a sheet.
	if (isPhone) {
		return (
			<>
				{!onBoard && <div className='tips-center'>{trigger}</div>}
				<Modal open={isOpen} onClose={() => close(false)} title={t('tips.label')} className='tips-sheet'>
					{body}
				</Modal>
			</>
		)
	}

	return (
		<div className='tips-center' ref={wrapperRef}>
			{trigger}
			{isOpen && (
				<div className='tips-panel' role='dialog' aria-label={t('tips.label')}>
					<div className='tips-panel__head'>
						<h2 className='tips-panel__title'><Lightbulb size={16} aria-hidden='true' />{t('tips.label')}</h2>
						<IconButton icon={X} size='sm' label={t('tips.close')} onClick={() => close()} />
					</div>
					{body}
				</div>
			)}
		</div>
	)
}

export default TipsCenter
