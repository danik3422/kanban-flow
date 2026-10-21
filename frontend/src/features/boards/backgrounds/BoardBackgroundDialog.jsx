import { useState } from 'react'
import { useI18n } from '../../../i18n'
import { useServerConfig } from '../../../lib/serverConfig'
import { Modal } from '../../../ui'
import BackgroundAdjust from './BackgroundAdjust'
import { BackgroundOverview, ColorsPanel, PhotosPanel } from './BackgroundPicker'
import { isPhotoBackground } from './boardBackground'
import { OwnPhoto } from './OwnPhoto'
import { usePhotoSearch } from './usePhotoSearch'

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
					{canUpload && <OwnPhoto value={value} onPick={onUpload} onAdjust={() => setView('adjust')} />}
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
