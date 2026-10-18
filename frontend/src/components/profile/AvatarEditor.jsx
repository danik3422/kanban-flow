import { ImagePlus, Minus, Plus, RotateCcw, RotateCw, Upload } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useI18n } from '../../i18n'
import { Button, IconButton, Modal } from '../../ui'
import { cx } from '../../ui/utils'
import { coverScale, isSupportedImage, loadImage, renderAvatarCrop, rotatedSize } from '../../utils/image'
import './avatar-editor.css'

const FRAME = 280
const MIN_ZOOM = 1
const MAX_ZOOM = 4
const PREVIEWS = [64, 40, 24]

// Keeps the photo covering the whole frame whatever the zoom or turn.
const clampOffset = (image, rotation, zoom, offset) => {
	if (!image) return offset
	const { width, height } = rotatedSize(image, rotation)
	const scale = coverScale(image, rotation, FRAME) * zoom
	const maxX = Math.max(0, (width * scale - FRAME) / 2)
	const maxY = Math.max(0, (height * scale - FRAME) / 2)
	return { x: Math.min(maxX, Math.max(-maxX, offset.x)), y: Math.min(maxY, Math.max(-maxY, offset.y)) }
}

const clampZoom = (value) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))

const PhotoLayer = ({ image, src, zoom, rotation, offset }) => {
	const scale = coverScale(image, rotation, FRAME) * zoom
	return (
		<img
			className='av-editor__image'
			src={src}
			alt=''
			draggable={false}
			style={{
				width: image.naturalWidth,
				height: image.naturalHeight,
				transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) rotate(${rotation}deg) scale(${scale})`,
			}}
		/>
	)
}

/**
 * Pick a photo, then choose the part that goes in the circle: drag to move,
 * zoom with the slider, wheel or a pinch, turn it, and see the result at the
 * sizes it appears in the app before saving.
 */
const AvatarEditor = ({ open, initialFile, name, onClose, onSave }) => {
	const { t } = useI18n()
	const [photo, setPhoto] = useState(null)
	const [zoom, setZoom] = useState(1)
	const [rotation, setRotation] = useState(0)
	const [offset, setOffset] = useState({ x: 0, y: 0 })
	const [error, setError] = useState('')
	const [isDragOver, setIsDragOver] = useState(false)
	const [isSaving, setIsSaving] = useState(false)
	const inputRef = useRef(null)
	const frameRef = useRef(null)
	const pointers = useRef(new Map())
	const gesture = useRef(null)
	const view = useRef({ zoom, rotation, offset, photo })
	useLayoutEffect(() => {
		view.current = { zoom, rotation, offset, photo }
	})

	const reset = () => {
		setZoom(1)
		setRotation(0)
		setOffset({ x: 0, y: 0 })
	}

	const openFile = useCallback(async (file) => {
		if (!file) return
		if (!isSupportedImage(file)) {
			setError(t('profile.photo.invalid'))
			return
		}
		try {
			const image = await loadImage(file)
			setPhoto((current) => {
				if (current?.src) URL.revokeObjectURL(current.src)
				return { image, src: URL.createObjectURL(file) }
			})
			setError('')
			setZoom(1)
			setRotation(0)
			setOffset({ x: 0, y: 0 })
		} catch {
			setError(t('profile.photo.unreadable'))
		}
	}, [t])

	// A fresh start each time the editor opens, with the file the page passed in.
	const [wasOpen, setWasOpen] = useState(false)
	if (open !== wasOpen) {
		setWasOpen(open)
		if (!open) {
			setPhoto(null)
			setError('')
			setIsSaving(false)
		}
	}
	useEffect(() => {
		if (open && initialFile) queueMicrotask(() => openFile(initialFile))
	}, [open, initialFile, openFile])
	useEffect(() => () => {
		if (photo?.src) URL.revokeObjectURL(photo.src)
	}, [photo])

	// Paste an image straight from the clipboard.
	useEffect(() => {
		if (!open) return undefined
		const onPaste = (event) => {
			const file = [...(event.clipboardData?.files || [])].find((item) => item.type.startsWith('image/'))
			if (file) {
				event.preventDefault()
				openFile(file)
			}
		}
		window.addEventListener('paste', onPaste)
		return () => window.removeEventListener('paste', onPaste)
	}, [open, openFile])

	const applyZoom = useCallback((next) => {
		const { zoom: current, rotation: turn, offset: shift, photo: active } = view.current
		const value = clampZoom(next)
		const ratio = value / current
		setZoom(value)
		setOffset(clampOffset(active?.image, turn, value, { x: shift.x * ratio, y: shift.y * ratio }))
	}, [])

	// Wheel zoom needs a non-passive listener to keep the page from scrolling.
	useEffect(() => {
		const frame = frameRef.current
		if (!frame) return undefined
		const onWheel = (event) => {
			event.preventDefault()
			applyZoom(view.current.zoom * Math.exp(-event.deltaY * 0.0015))
		}
		frame.addEventListener('wheel', onWheel, { passive: false })
		return () => frame.removeEventListener('wheel', onWheel)
	}, [photo, applyZoom])

	useEffect(() => () => document.body.classList.remove('is-cropping'), [])

	const onPointerDown = (event) => {
		if (event.pointerType === 'mouse' && event.button !== 0) return
		// Holding the mouse down must move the photo, never start selecting the text around it.
		event.preventDefault()
		window.getSelection()?.removeAllRanges()
		frameRef.current?.focus({ preventScroll: true })
		document.body.classList.add('is-cropping')
		frameRef.current?.setPointerCapture(event.pointerId)
		pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
		const points = [...pointers.current.values()]
		gesture.current = points.length >= 2
			? { type: 'pinch', distance: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y), zoom }
			: { type: 'pan', x: event.clientX, y: event.clientY, offset }
	}
	const onPointerMove = (event) => {
		if (!pointers.current.has(event.pointerId) || !gesture.current) return
		pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
		const points = [...pointers.current.values()]
		if (gesture.current.type === 'pinch' && points.length >= 2) {
			const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)
			applyZoom(gesture.current.zoom * (distance / gesture.current.distance))
		} else if (gesture.current.type === 'pan') {
			const start = gesture.current
			setOffset(clampOffset(photo?.image, rotation, zoom, { x: start.offset.x + event.clientX - start.x, y: start.offset.y + event.clientY - start.y }))
		}
	}
	const onPointerUp = (event) => {
		pointers.current.delete(event.pointerId)
		const [rest] = [...pointers.current.values()]
		gesture.current = rest ? { type: 'pan', x: rest.x, y: rest.y, offset } : null
		if (!rest) document.body.classList.remove('is-cropping')
	}

	const onKeyDown = (event) => {
		const step = event.shiftKey ? 40 : 10
		const moves = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }
		if (moves[event.key]) {
			event.preventDefault()
			const [dx, dy] = moves[event.key]
			setOffset(clampOffset(photo?.image, rotation, zoom, { x: offset.x + dx, y: offset.y + dy }))
		} else if (event.key === '+' || event.key === '=') {
			event.preventDefault()
			applyZoom(zoom + 0.1)
		} else if (event.key === '-') {
			event.preventDefault()
			applyZoom(zoom - 0.1)
		}
	}

	const turn = (delta) => {
		const next = (rotation + delta + 360) % 360
		setRotation(next)
		setOffset(clampOffset(photo?.image, next, zoom, offset))
	}

	const save = async () => {
		if (!photo || isSaving) return
		setIsSaving(true)
		try {
			const dataUrl = renderAvatarCrop({ image: photo.image, viewport: FRAME, zoom, rotation, offset })
			const saved = await onSave(dataUrl)
			if (saved !== false) onClose()
		} catch {
			setError(t('profile.photo.tooDetailed'))
		} finally {
			setIsSaving(false)
		}
	}

	const pick = (
		<input
			ref={inputRef}
			type='file'
			accept='image/jpeg,image/png,image/webp'
			hidden
			aria-label={t('profile.photo.choose')}
			onChange={(event) => {
				openFile(event.target.files?.[0])
				event.target.value = ''
			}}
		/>
	)

	return (
		<Modal
			open={open}
			onClose={isSaving ? undefined : onClose}
			title={photo ? t('profile.photo.adjustTitle') : t('profile.photo.addTitle')}
			description={photo ? t('profile.photo.adjustText') : t('profile.photo.addText')}
			className='av-editor-modal'
			footer={photo && (
				<>
					<Button variant='ghost' icon={ImagePlus} onClick={() => inputRef.current?.click()} disabled={isSaving} className='av-editor__other'>{t('profile.photo.other')}</Button>
					<Button variant='secondary' onClick={onClose} disabled={isSaving}>{t('common.cancel')}</Button>
					<Button onClick={save} loading={isSaving}>{t('profile.photo.save')}</Button>
				</>
			)}
		>
			{pick}
			{!photo ? (
				<button
					type='button'
					className={cx('av-drop', isDragOver && 'is-over')}
					onClick={() => inputRef.current?.click()}
					onDragOver={(event) => {
						event.preventDefault()
						setIsDragOver(true)
					}}
					onDragLeave={() => setIsDragOver(false)}
					onDrop={(event) => {
						event.preventDefault()
						setIsDragOver(false)
						openFile(event.dataTransfer.files?.[0])
					}}
				>
					<span className='av-drop__icon' aria-hidden='true'><Upload size={22} /></span>
					<span className='av-drop__title'>{t('profile.photo.drop')}</span>
					<span className='av-drop__hint'>{t('profile.photo.hint')}</span>
				</button>
			) : (
				<div className='av-editor'>
					<div className='av-editor__stage'>
						<div
							ref={frameRef}
							className='av-editor__frame'
							style={{ width: FRAME, height: FRAME }}
							tabIndex={0}
							role='group'
							aria-label={t('profile.photo.frameLabel')}
							onPointerDown={onPointerDown}
							onPointerMove={onPointerMove}
							onPointerUp={onPointerUp}
							onPointerCancel={onPointerUp}
							onKeyDown={onKeyDown}
						>
							<PhotoLayer image={photo.image} src={photo.src} zoom={zoom} rotation={rotation} offset={offset} />
							<span className='av-editor__mask' aria-hidden='true' />
						</div>
						<div className='av-editor__previews' aria-hidden='true'>
							{PREVIEWS.map((size) => (
								<span key={size} className='av-editor__preview' style={{ width: size, height: size }}>
									<span className='av-editor__preview-inner' style={{ width: FRAME, height: FRAME, transform: `scale(${size / FRAME})` }}>
										<PhotoLayer image={photo.image} src={photo.src} zoom={zoom} rotation={rotation} offset={offset} />
									</span>
								</span>
							))}
							<span className='av-editor__preview-name' data-i18n-ignore>{name}</span>
						</div>
					</div>
					<div className='av-editor__controls'>
						<IconButton icon={Minus} size='sm' label={t('profile.photo.zoomOut')} onClick={() => applyZoom(zoom - 0.2)} disabled={zoom <= MIN_ZOOM} />
						<input
							className='av-editor__zoom'
							type='range'
							min={MIN_ZOOM}
							max={MAX_ZOOM}
							step={0.01}
							value={zoom}
							onChange={(event) => applyZoom(Number(event.target.value))}
							aria-label={t('profile.photo.zoom')}
							aria-valuetext={`${Math.round(zoom * 100)}%`}
						/>
						<IconButton icon={Plus} size='sm' label={t('profile.photo.zoomIn')} onClick={() => applyZoom(zoom + 0.2)} disabled={zoom >= MAX_ZOOM} />
						<span className='av-editor__divider' aria-hidden='true' />
						<IconButton icon={RotateCcw} size='sm' label={t('profile.photo.rotateLeft')} onClick={() => turn(-90)} />
						<IconButton icon={RotateCw} size='sm' label={t('profile.photo.rotateRight')} onClick={() => turn(90)} />
						<Button variant='ghost' size='sm' onClick={reset} disabled={zoom === 1 && rotation === 0 && !offset.x && !offset.y}>{t('profile.photo.reset')}</Button>
					</div>
					<p className='av-editor__tip'>{t('profile.photo.tip')}</p>
				</div>
			)}
			{error && <p className='ui-field__error av-editor__error' role='alert'>{error}</p>}
		</Modal>
	)
}

export default AvatarEditor
