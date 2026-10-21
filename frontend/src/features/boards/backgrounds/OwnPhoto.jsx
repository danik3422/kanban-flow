import { ImagePlus, Loader2, SlidersHorizontal } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { useI18n } from '../../../i18n'
import { translateServerMessageCurrent } from '../../../i18n/translate'
import { Button } from '../../../ui'
import { cx } from '../../../ui/utils'
import { BackgroundSwatch } from './BackgroundPicker'
import { isPhotoBackground } from './boardBackground'
import { prepareBackgroundImage } from './prepareBackgroundImage'

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif'

/**
 * Picking a photo from the device: click or drop a file, it is resized in the browser,
 * then handed to `onPick` (which uploads it, or keeps it until the board exists).
 * `onPick` resolves to true when the photo is in place.
 */
const usePhotoFile = (onPick, onPicked) => {
	const { t } = useI18n()
	const inputRef = useRef(null)
	const [isBusy, setIsBusy] = useState(false)
	const [isOver, setIsOver] = useState(false)
	const pick = async (file) => {
		if (!file || isBusy) return
		setIsBusy(true)
		try {
			const prepared = await prepareBackgroundImage(file)
			if (await onPick(prepared)) onPicked?.()
		} catch (error) {
			if (error.code) toast.error(t(`backgrounds.own.errors.${error.code}`))
			else toast.error(translateServerMessageCurrent(error.response?.data?.message, 'backgrounds.own.errors.upload'))
		} finally {
			setIsBusy(false)
		}
	}
	const target = {
		disabled: isBusy,
		onClick: () => inputRef.current?.click(),
		onDragOver: (event) => {
			event.preventDefault()
			setIsOver(true)
		},
		onDragLeave: () => setIsOver(false),
		onDrop: (event) => {
			event.preventDefault()
			setIsOver(false)
			pick(event.dataTransfer.files?.[0])
		},
	}
	const input = (
		<input
			ref={inputRef}
			type='file'
			accept={ACCEPT}
			hidden
			onChange={(event) => {
				pick(event.target.files?.[0])
				event.target.value = ''
			}}
		/>
	)
	return { target, input, isBusy, isOver }
}

/** "Your photo": the current one with a way to adjust it, and a place to drop another. */
export const OwnPhoto = ({ value, onPick, onAdjust }) => {
	const { t } = useI18n()
	const { target, input, isBusy, isOver } = usePhotoFile(onPick, onAdjust)
	const current = value?.type === 'upload' ? value : null
	const icon = isBusy ? <Loader2 size={20} className='bg-spin' /> : <ImagePlus size={20} />
	return (
		<section className='bg-browser__section'>
			<div className='bg-browser__head'>
				<h3 className='bg-browser__title'>{t('backgrounds.own.title')}</h3>
				{isPhotoBackground(value) && <Button variant='secondary' size='sm' icon={SlidersHorizontal} onClick={onAdjust}>{t('backgrounds.adjust.open')}</Button>}
			</div>
			{current ? (
				<div className='bg-own'>
					<BackgroundSwatch size='xl' background={current} selected label={t('backgrounds.own.current')} onSelect={onAdjust} className='bg-own__current' />
					<button type='button' className={cx('bg-upload bg-upload--tile', isOver && 'is-over')} {...target}>
						<span className='bg-upload__icon' aria-hidden='true'>{icon}</span>
						<span className='bg-upload__title'>{isBusy ? t('backgrounds.own.uploading') : t('backgrounds.own.replace')}</span>
					</button>
				</div>
			) : (
				<button type='button' className={cx('bg-upload', isOver && 'is-over')} {...target}>
					<span className='bg-upload__icon' aria-hidden='true'>{icon}</span>
					<span className='bg-upload__text'>
						<span className='bg-upload__title'>{isBusy ? t('backgrounds.own.uploading') : t('backgrounds.own.upload')}</span>
						<span className='bg-upload__hint'>{t('backgrounds.own.hint')}</span>
					</span>
				</button>
			)}
			{current && <p className='bg-own__hint'>{t('backgrounds.own.hint')}</p>}
			{input}
		</section>
	)
}

/** A small tile in the create-board picker that opens the file chooser. */
export const UploadSwatch = ({ onPick }) => {
	const { t } = useI18n()
	const { target, input, isBusy, isOver } = usePhotoFile(onPick)
	return (
		<>
			<button type='button' className={cx('bg-swatch bg-swatch--sm bg-swatch--upload', isOver && 'is-over')} aria-label={t('backgrounds.own.upload')} title={t('backgrounds.own.upload')} {...target}>
				{isBusy ? <Loader2 size={18} className='bg-spin' aria-hidden='true' /> : <ImagePlus size={18} aria-hidden='true' />}
			</button>
			{input}
		</>
	)
}
