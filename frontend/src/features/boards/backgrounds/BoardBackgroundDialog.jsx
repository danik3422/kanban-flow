import { ImagePlus, Loader2, SlidersHorizontal } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { useI18n } from '../../../i18n'
import { translateServerMessageCurrent } from '../../../i18n/translate'
import { useServerConfig } from '../../../lib/serverConfig'
import { Button, Modal } from '../../../ui'
import { cx } from '../../../ui/utils'
import BackgroundAdjust from './BackgroundAdjust'
import { BackgroundOverview, BackgroundSwatch, ColorsPanel, PhotosPanel } from './BackgroundPicker'
import { isPhotoBackground } from './boardBackground'
import { prepareBackgroundImage } from './prepareBackgroundImage'
import { usePhotoSearch } from './usePhotoSearch'

/** Upload your own photo: click or drop a file; it is resized in the browser first. */
const OwnPhoto = ({ value, onUpload, onAdjust }) => {
	const { t } = useI18n()
	const inputRef = useRef(null)
	const [isUploading, setIsUploading] = useState(false)
	const [isOver, setIsOver] = useState(false)
	const upload = async (file) => {
		if (!file || isUploading) return
		setIsUploading(true)
		try {
			const prepared = await prepareBackgroundImage(file)
			if (await onUpload(prepared)) onAdjust()
		} catch (error) {
			if (error.code) toast.error(t(`backgrounds.own.errors.${error.code}`))
			else toast.error(translateServerMessageCurrent(error.response?.data?.message, 'backgrounds.own.errors.upload'))
		} finally {
			setIsUploading(false)
		}
	}
	return (
		<section className='bg-browser__section'>
			<div className='bg-browser__head'>
				<h3 className='bg-browser__title'>{t('backgrounds.own.title')}</h3>
				{isPhotoBackground(value) && <Button variant='secondary' size='sm' icon={SlidersHorizontal} onClick={onAdjust}>{t('backgrounds.adjust.open')}</Button>}
			</div>
			<div className='bg-own'>
				{value?.type === 'upload' && <BackgroundSwatch size='lg' background={value} selected label={t('backgrounds.own.current')} onSelect={onAdjust} className='bg-own__current' />}
				<button
					type='button'
					className={cx('bg-upload', isOver && 'is-over')}
					disabled={isUploading}
					onClick={() => inputRef.current?.click()}
					onDragOver={(event) => {
						event.preventDefault()
						setIsOver(true)
					}}
					onDragLeave={() => setIsOver(false)}
					onDrop={(event) => {
						event.preventDefault()
						setIsOver(false)
						upload(event.dataTransfer.files?.[0])
					}}
				>
					<span className='bg-upload__icon' aria-hidden='true'>{isUploading ? <Loader2 size={20} className='bg-spin' /> : <ImagePlus size={20} />}</span>
					<span className='bg-upload__text'>
						<span className='bg-upload__title'>{isUploading ? t('backgrounds.own.uploading') : value?.type === 'upload' ? t('backgrounds.own.replace') : t('backgrounds.own.upload')}</span>
						<span className='bg-upload__hint'>{t('backgrounds.own.hint')}</span>
					</span>
				</button>
				<input
					ref={inputRef}
					type='file'
					accept='image/jpeg,image/png,image/webp,image/gif'
					hidden
					onChange={(event) => {
						upload(event.target.files?.[0])
						event.target.value = ''
					}}
				/>
			</div>
		</section>
	)
}

/**
 * Change an existing board's background. Every pick applies at once (the board
 * behind the dialog shows it), like Trello's side menu; "Remove" goes back to plain.
 * Board admins can also upload a photo of their own and adjust how any photo looks.
 */
const BoardBackgroundDialog = ({ open, onClose, value, onChange, onUpload, canUpload = true }) => {
	const { t } = useI18n()
	const photosOnline = useServerConfig((state) => state.photos)
	const [view, setView] = useState('overview')
	const featured = usePhotoSearch('', open && photosOnline)
	const [wasOpen, setWasOpen] = useState(open)
	if (wasOpen !== open) {
		setWasOpen(open)
		if (open) setView('overview')
	}
	const titles = { overview: t('backgrounds.title'), colors: t('backgrounds.colors'), photos: t('backgrounds.photos'), adjust: t('backgrounds.adjust.title') }
	return (
		<Modal
			open={open}
			onClose={onClose}
			onBack={view !== 'overview' ? () => setView('overview') : undefined}
			title={titles[view]}
			variant='panel'
			className='board-bg-dialog'
		>
			{view === 'overview' && (
				<div className='bg-browser'>
					{canUpload && <OwnPhoto value={value} onUpload={onUpload} onAdjust={() => setView('adjust')} />}
					<BackgroundOverview value={value} onChange={onChange} photos={featured.photos} showPhotos={photosOnline} onOpenPhotos={() => setView('photos')} onOpenColors={() => setView('colors')} onClear={() => onChange(null)} />
				</div>
			)}
			{view === 'colors' && <ColorsPanel value={value} onChange={onChange} />}
			{view === 'photos' && <PhotosPanel value={value} onChange={onChange} />}
			{view === 'adjust' && isPhotoBackground(value) && <BackgroundAdjust key={value.url || value.id} value={value} onChange={onChange} />}
		</Modal>
	)
}

export default BoardBackgroundDialog
