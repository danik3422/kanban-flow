import { Check, Loader2, MoreHorizontal, Search, SearchX } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../../i18n'
import { Button, EmptyState, Input, Skeleton } from '../../../ui'
import { cx } from '../../../ui/utils'
import { backgroundCss, COLOR_KEYS, GRADIENT_KEYS, paletteBackground, sameBackground } from './boardBackground'
import { usePhotoSearch } from './usePhotoSearch'
import './board-background.css'

/** One choosable background: a photo or colour tile with a check when selected. */
export const BackgroundSwatch = ({ background, selected, label, onSelect, size = 'md', className }) => (
	<button
		type='button'
		className={cx('bg-swatch', `bg-swatch--${size}`, selected && 'is-selected', className)}
		style={{ background: backgroundCss(background, { thumb: true }) }}
		aria-pressed={selected}
		aria-label={label}
		title={label}
		onClick={() => onSelect(background)}
	>
		{selected && <span className='bg-swatch__check' aria-hidden='true'><Check size={14} strokeWidth={3} /></span>}
	</button>
)

const photoLabel = (t, photo) => (photo.author ? t('backgrounds.photoBy', { name: photo.author }) : t('backgrounds.photo'))

/** Create-board row: four photos, five gradients and "more". */
export const CompactPicker = ({ value, onChange, photos, onMore }) => {
	const { t } = useI18n()
	return (
		<div className='bg-compact' role='group' aria-label={t('backgrounds.title')}>
			<div className='bg-compact__photos'>
				{photos.length
					? photos.slice(0, 4).map((photo) => (
						<BackgroundSwatch key={photo.id} background={{ type: 'photo', ...photo }} selected={sameBackground(value, { type: 'photo', id: photo.id })} label={photoLabel(t, photo)} onSelect={onChange} />
					))
					: [0, 1, 2, 3].map((index) => <Skeleton key={index} height={44} radius={8} />)}
			</div>
			<div className='bg-compact__colors'>
				{GRADIENT_KEYS.slice(0, 5).map((key) => (
					<BackgroundSwatch key={key} size='sm' background={paletteBackground('gradient', key)} selected={sameBackground(value, paletteBackground('gradient', key))} label={t(`backgrounds.gradients.${key}`)} onSelect={onChange} />
				))}
				<button type='button' className='bg-swatch bg-swatch--sm bg-swatch--more' onClick={onMore} aria-label={t('backgrounds.more')} title={t('backgrounds.more')}>
					<MoreHorizontal size={18} aria-hidden='true' />
				</button>
			</div>
		</div>
	)
}

/** "Board background": a taste of photos and colours, each with "View more". */
export const BackgroundOverview = ({ value, onChange, photos, showPhotos = true, onOpenPhotos, onOpenColors, onClear }) => {
	const { t } = useI18n()
	return (
		<div className='bg-browser'>
			{showPhotos && <section className='bg-browser__section'>
				<div className='bg-browser__head'>
					<h3 className='bg-browser__title'>{t('backgrounds.photos')}</h3>
					<Button variant='secondary' size='sm' onClick={onOpenPhotos}>{t('backgrounds.viewMore')}</Button>
				</div>
				<div className='bg-grid bg-grid--3'>
					{photos.length
						? photos.slice(0, 6).map((photo) => (
							<BackgroundSwatch key={photo.id} size='lg' background={{ type: 'photo', ...photo }} selected={sameBackground(value, { type: 'photo', id: photo.id })} label={photoLabel(t, photo)} onSelect={onChange} />
						))
						: [0, 1, 2, 3, 4, 5].map((index) => <Skeleton key={index} height={72} radius={10} />)}
				</div>
			</section>}
			<section className='bg-browser__section'>
				<div className='bg-browser__head'>
					<h3 className='bg-browser__title'>{t('backgrounds.colors')}</h3>
					<Button variant='secondary' size='sm' onClick={onOpenColors}>{t('backgrounds.viewMore')}</Button>
				</div>
				<div className='bg-grid bg-grid--3'>
					{GRADIENT_KEYS.slice(0, 6).map((key) => (
						<BackgroundSwatch key={key} size='lg' background={paletteBackground('gradient', key)} selected={sameBackground(value, paletteBackground('gradient', key))} label={t(`backgrounds.gradients.${key}`)} onSelect={onChange} />
					))}
				</div>
			</section>
			{onClear && value && (
				<Button variant='ghost' onClick={onClear} className='bg-browser__clear'>{t('backgrounds.clear')}</Button>
			)}
		</div>
	)
}

/** All gradients, then all plain colours. */
export const ColorsPanel = ({ value, onChange }) => {
	const { t } = useI18n()
	return (
		<div className='bg-browser'>
			<div className='bg-grid bg-grid--3'>
				{GRADIENT_KEYS.map((key) => (
					<BackgroundSwatch key={key} size='lg' background={paletteBackground('gradient', key)} selected={sameBackground(value, paletteBackground('gradient', key))} label={t(`backgrounds.gradients.${key}`)} onSelect={onChange} />
				))}
			</div>
			<hr className='bg-browser__divider' />
			<div className='bg-grid bg-grid--3'>
				{COLOR_KEYS.map((key) => (
					<BackgroundSwatch key={key} size='lg' background={paletteBackground('color', key)} selected={sameBackground(value, paletteBackground('color', key))} label={t(`backgrounds.colorNames.${key}`)} onSelect={onChange} />
				))}
			</div>
		</div>
	)
}

/** Searchable photos with endless scrolling and the photographer's credit. */
export const PhotosPanel = ({ value, onChange }) => {
	const { t } = useI18n()
	const [query, setQuery] = useState('')
	const search = usePhotoSearch(query)
	const sentinelRef = useRef(null)
	const loadMoreRef = useRef(search.loadMore)
	useEffect(() => {
		loadMoreRef.current = search.loadMore
	})

	useEffect(() => {
		const sentinel = sentinelRef.current
		if (!sentinel) return undefined
		const observer = new IntersectionObserver((entries) => {
			if (entries.some((entry) => entry.isIntersecting)) loadMoreRef.current()
		}, { rootMargin: '200px' })
		observer.observe(sentinel)
		return () => observer.disconnect()
		// Re-observing after every page catches a sentinel that is still in view.
	}, [search.photos.length, search.page])

	return (
		<div className='bg-browser bg-photos'>
			<Input icon={Search} type='search' value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('backgrounds.searchPhotos')} aria-label={t('backgrounds.searchPhotos')} />
			{search.failed && !search.photos.length ? (
				<EmptyState icon={SearchX} title={t('backgrounds.loadError')} action={<Button variant='secondary' onClick={search.retry}>{t('common.retry')}</Button>} />
			) : !search.loading && !search.photos.length ? (
				<EmptyState icon={SearchX} title={t('backgrounds.noPhotos')} description={t('backgrounds.noPhotosText')} />
			) : (
				<div className='bg-grid bg-grid--2'>
					{search.photos.map((photo) => (
						<div key={photo.id} className='bg-photo'>
							<BackgroundSwatch size='xl' background={{ type: 'photo', ...photo }} selected={sameBackground(value, { type: 'photo', id: photo.id })} label={photoLabel(t, photo)} onSelect={onChange} />
							{photo.author && (
								<a className='bg-photo__credit' href={photo.authorUrl} target='_blank' rel='noopener noreferrer' title={[photo.author, photo.license, photo.source].filter(Boolean).join(' · ')} data-i18n-ignore>{photo.author}</a>
							)}
						</div>
					))}
					{search.loading && [0, 1, 2, 3].map((index) => <Skeleton key={`loading-${index}`} height={96} radius={10} />)}
				</div>
			)}
			<div ref={sentinelRef} className='bg-photos__sentinel' aria-hidden='true'>{search.loading && search.photos.length > 0 && <Loader2 size={18} className='bg-spin' />}</div>
			<p className='bg-photos__source'>
				{t('backgrounds.photosBy')} <a href='https://unsplash.com/?utm_source=kanbanhub&utm_medium=referral' target='_blank' rel='noopener noreferrer'>Unsplash</a>
				{search.source === 'commons' && <> · <a href='https://commons.wikimedia.org/wiki/Commons:Quality_images' target='_blank' rel='noopener noreferrer'>Wikimedia Commons</a></>}
			</p>
		</div>
	)
}
