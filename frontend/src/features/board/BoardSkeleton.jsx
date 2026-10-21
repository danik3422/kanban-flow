import { useI18n } from '../../i18n'
import { Skeleton } from '../../ui'

// A few lists of different lengths, so the placeholder reads as a board.
const LISTS = [[64, 40, 52], [40, 64], [52, 40, 64, 40], [40]]

/** The board's lists while they load: same size and spacing as the real ones. */
const BoardSkeleton = () => {
	const { t } = useI18n()
	return (
		<div className='bc-scroll bc-skeleton' role='status' aria-live='polite' aria-label={t('columns.loading')}>
			<div className='bc-board' aria-hidden='true'>
				{LISTS.map((cards, list) => (
					<div className='bc-skeleton__column' key={list}>
						<div className='bc-skeleton__head'><Skeleton width={`${46 + list * 9}%`} height={14} /></div>
						<div className='bc-skeleton__cards'>
							{cards.map((height, card) => <Skeleton key={card} className='bc-skeleton__card' height={height} radius={10} />)}
						</div>
						<div className='bc-skeleton__foot'><Skeleton width='42%' height={12} /></div>
					</div>
				))}
			</div>
		</div>
	)
}

export default BoardSkeleton
