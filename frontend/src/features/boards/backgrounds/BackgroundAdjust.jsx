import { RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../../i18n'
import { Button } from '../../../ui'
import { adjustOf, backdropStyle, DEFAULT_ADJUST } from './boardBackground'

const SLIDERS = [
	{ key: 'blur', min: 0, max: 24, step: 1, unit: 'px' },
	{ key: 'dim', min: 0, max: 80, step: 1, unit: '%' },
	{ key: 'brightness', min: 50, max: 150, step: 1, unit: '%' },
	{ key: 'saturate', min: 0, max: 200, step: 1, unit: '%' },
]
const SAVE_DELAY_MS = 350

/**
 * How a photo background looks: drag on the preview to choose the point that stays
 * in view, then blur, darken, brighten or tone down the colours so the lists read
 * well on top. Every change shows on the board behind the dialog and is saved shortly after.
 */
const BackgroundAdjust = ({ value, onChange }) => {
	const { t } = useI18n()
	const [draft, setDraft] = useState(() => adjustOf(value))
	const previewRef = useRef(null)
	const dragging = useRef(false)
	const pending = useRef(null)
	const latest = useRef({ value, onChange })
	useEffect(() => {
		latest.current = { value, onChange }
	})

	const flush = () => {
		if (!pending.current) return
		window.clearTimeout(pending.current.timer)
		const { adjust } = pending.current
		pending.current = null
		latest.current.onChange({ ...latest.current.value, adjust })
	}
	// Leaving the editor saves what is still waiting.
	useEffect(() => flush, [])

	const update = (patch) => {
		setDraft((current) => {
			const next = { ...current, ...patch }
			if (pending.current) window.clearTimeout(pending.current.timer)
			pending.current = { adjust: next, timer: window.setTimeout(flush, SAVE_DELAY_MS) }
			return next
		})
	}

	const focusFrom = (event) => {
		const box = previewRef.current.getBoundingClientRect()
		const clamp = (number) => Math.round(Math.min(100, Math.max(0, number)))
		update({ x: clamp(((event.clientX - box.left) / box.width) * 100), y: clamp(((event.clientY - box.top) / box.height) * 100) })
	}
	const moveFocus = (event) => {
		const step = event.shiftKey ? 10 : 2
		const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
		const move = moves[event.key]
		if (!move) return
		event.preventDefault()
		update({ x: Math.min(100, Math.max(0, draft.x + move[0])), y: Math.min(100, Math.max(0, draft.y + move[1])) })
	}

	const isDefault = Object.entries(DEFAULT_ADJUST).every(([key, number]) => draft[key] === number)

	return (
		<div className='bg-adjust'>
			<div
				ref={previewRef}
				className='bg-adjust__preview'
				style={backdropStyle({ ...value, adjust: draft })}
				tabIndex={0}
				role='group'
				aria-label={t('backgrounds.adjust.focusLabel', { x: draft.x, y: draft.y })}
				onPointerDown={(event) => {
					dragging.current = true
					event.currentTarget.setPointerCapture(event.pointerId)
					focusFrom(event)
				}}
				onPointerMove={(event) => dragging.current && focusFrom(event)}
				onPointerUp={() => {
					dragging.current = false
				}}
				onPointerCancel={() => {
					dragging.current = false
				}}
				onKeyDown={moveFocus}
			>
				<div className='board-backdrop' aria-hidden='true' />
				{/* A sketch of lists, to judge how readable the board will be. */}
				<div className='bg-adjust__lists' aria-hidden='true'>
					{[3, 2, 4].map((cards, index) => (
						<span key={index} className='bg-adjust__list'>
							{Array.from({ length: cards }, (_, card) => <span key={card} className='bg-adjust__card' />)}
						</span>
					))}
				</div>
				<span className='bg-adjust__focus' style={{ left: `${draft.x}%`, top: `${draft.y}%` }} aria-hidden='true' />
			</div>
			<p className='bg-adjust__hint'>{t('backgrounds.adjust.focusHint')}</p>

			<div className='bg-adjust__sliders'>
				{SLIDERS.map(({ key, min, max, step, unit }) => (
					<label key={key} className='bg-adjust__slider'>
						<span className='bg-adjust__label'>
							{t(`backgrounds.adjust.${key}`)}
							<span className='bg-adjust__value'>{draft[key]}{unit}</span>
						</span>
						<input type='range' min={min} max={max} step={step} value={draft[key]} onChange={(event) => update({ [key]: Number(event.target.value) })} />
					</label>
				))}
			</div>

			<Button variant='ghost' icon={RotateCcw} disabled={isDefault} onClick={() => update(DEFAULT_ADJUST)} className='bg-adjust__reset'>
				{t('backgrounds.adjust.reset')}
			</Button>
		</div>
	)
}

export default BackgroundAdjust
