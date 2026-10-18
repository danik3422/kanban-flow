import { useState } from 'react'
import { useI18n } from '../../i18n'
import { Modal } from '../../ui'
import { BackgroundOverview, ColorsPanel, PhotosPanel, usePhotoSearch } from './BackgroundPicker'

/**
 * Change an existing board's background. Every pick applies at once (the board
 * behind the dialog shows it), like Trello's side menu; "Remove" goes back to plain.
 */
const BoardBackgroundDialog = ({ open, onClose, value, onChange }) => {
	const { t } = useI18n()
	const [view, setView] = useState('overview')
	const featured = usePhotoSearch('', open)
	const [wasOpen, setWasOpen] = useState(open)
	if (wasOpen !== open) {
		setWasOpen(open)
		if (open) setView('overview')
	}
	const titles = { overview: t('backgrounds.title'), colors: t('backgrounds.colors'), photos: t('backgrounds.photos') }
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
				<BackgroundOverview value={value} onChange={onChange} photos={featured.photos} onOpenPhotos={() => setView('photos')} onOpenColors={() => setView('colors')} onClear={() => onChange(null)} />
			)}
			{view === 'colors' && <ColorsPanel value={value} onChange={onChange} />}
			{view === 'photos' && <PhotosPanel value={value} onChange={onChange} />}
		</Modal>
	)
}

export default BoardBackgroundDialog
