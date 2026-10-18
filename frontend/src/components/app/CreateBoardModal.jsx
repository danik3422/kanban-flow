import { Globe, Lock, Plus, Users } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../i18n'
import { Button, ConfirmDialog, Field, Input, Modal, RadioCards } from '../../ui'
import { cx } from '../../ui/utils'
import { backgroundCss } from '../../utils/boardBackground'
import { BackgroundOverview, ColorsPanel, CompactPicker, PhotosPanel, usePhotoSearch } from '../boards/BackgroundPicker'

const VISIBILITY_ICONS = { private: Lock, workspace: Users, public: Globe }

/** A tiny board standing on the chosen background, named as the user types. */
export const BoardPreview = ({ background, name }) => (
	<div className={cx('bg-preview', !background && 'is-plain')} style={background ? { background: backgroundCss(background) } : undefined} aria-hidden='true'>
		{name && <span className='bg-preview__name' data-i18n-ignore>{name}</span>}
		<div className='bg-preview__board'>
			<span className='bg-preview__column'><i /><i /><i className='is-tall' /></span>
			<span className='bg-preview__column'><i /><i className='is-tall' /></span>
			<span className='bg-preview__column'><i /><i /><i /><i /></span>
		</div>
	</div>
)

/**
 * Name a board, dress it with a background and choose who can open it. The
 * background browser opens inside the same dialog, with a way back.
 * Making it public asks once more, because anyone with its link can see it.
 */
const CreateBoardModal = ({ open, onClose, name, onNameChange, visibility, onVisibilityChange, background, onBackgroundChange, onSubmit, isSubmitting, error }) => {
	const { t } = useI18n()
	const nameRef = useRef(null)
	const [isConfirmingPublic, setIsConfirmingPublic] = useState(false)
	const [view, setView] = useState('form')
	const featured = usePhotoSearch('', open)

	// Start on the main view each time, like a fresh form.
	const [wasOpen, setWasOpen] = useState(open)
	if (wasOpen !== open) {
		setWasOpen(open)
		if (open) setView('form')
	}

	// Until the user picks one, the first featured photo is the board's background.
	const firstPhoto = featured.photos[0]
	useEffect(() => {
		if (open && background === undefined && firstPhoto) queueMicrotask(() => onBackgroundChange({ type: 'photo', ...firstPhoto }))
	}, [open, background, firstPhoto, onBackgroundChange])

	const chooseVisibility = (value) => {
		if (value === 'public') setIsConfirmingPublic(true)
		else onVisibilityChange(value)
	}

	const views = {
		form: { title: t('boards.create.title'), description: t('boards.create.description') },
		overview: { title: t('backgrounds.title'), back: 'form' },
		colors: { title: t('backgrounds.colors'), back: 'overview' },
		photos: { title: t('backgrounds.photos'), back: 'overview' },
	}
	const current = views[view]

	return (
		<>
			<Modal
				open={open && !isConfirmingPublic}
				onClose={isSubmitting ? undefined : onClose}
				onBack={current.back ? () => setView(current.back) : undefined}
				title={current.title}
				description={current.description}
				initialFocusRef={view === 'form' ? nameRef : undefined}
				className='create-board-modal'
				footer={view === 'form' ? (
					<>
						<Button variant='secondary' onClick={onClose} disabled={isSubmitting}>{t('common.cancel')}</Button>
						<Button type='submit' form='create-board-form' icon={Plus} loading={isSubmitting} disabled={!name.trim()}>
							{isSubmitting ? t('boards.create.creating') : t('boards.create.submit')}
						</Button>
					</>
				) : (
					<Button onClick={() => setView('form')} block>{t('backgrounds.done')}</Button>
				)}
			>
				{view === 'form' && (
					<form
						id='create-board-form'
						className='create-board-form'
						onSubmit={(event) => {
							event.preventDefault()
							if (name.trim() && !isSubmitting) onSubmit()
						}}
						noValidate
					>
						<BoardPreview background={background} name={name.trim()} />
						<div className='ui-field'>
							<span className='ui-field__label'>{t('backgrounds.label')}</span>
							<CompactPicker value={background} onChange={onBackgroundChange} photos={featured.photos} onMore={() => setView('overview')} />
						</div>
						<Field label={t('boards.create.name')} error={error}>
							<Input
								ref={nameRef}
								id='board-name'
								value={name}
								onChange={(event) => onNameChange(event.target.value)}
								placeholder={t('boards.create.namePlaceholder')}
								maxLength={100}
								autoComplete='off'
							/>
						</Field>
						<RadioCards
							legend={t('boards.create.access')}
							name='board-visibility'
							value={visibility}
							onChange={chooseVisibility}
							options={['private', 'workspace', 'public'].map((value) => ({
								value,
								icon: VISIBILITY_ICONS[value],
								label: t(`boards.visibility.${value}`),
								description: t(`boards.create.${value}Hint`),
							}))}
						/>
					</form>
				)}
				{view === 'overview' && (
					<BackgroundOverview value={background} onChange={onBackgroundChange} photos={featured.photos} onOpenPhotos={() => setView('photos')} onOpenColors={() => setView('colors')} />
				)}
				{view === 'colors' && <ColorsPanel value={background} onChange={onBackgroundChange} />}
				{view === 'photos' && <PhotosPanel value={background} onChange={onBackgroundChange} />}
			</Modal>
			<ConfirmDialog
				open={isConfirmingPublic}
				onClose={() => setIsConfirmingPublic(false)}
				onConfirm={() => {
					onVisibilityChange('public')
					setIsConfirmingPublic(false)
				}}
				title={t('boards.create.publicTitle')}
				description={t('boards.create.publicText')}
				confirmLabel={t('boards.create.publicConfirm')}
				tone='primary'
			/>
		</>
	)
}

export default CreateBoardModal
