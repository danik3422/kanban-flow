import { cx, initialsOf } from '../../ui/utils'
import { backgroundCss } from '../../utils/boardBackground'
import { boardToneFor as toneFor } from '../../utils/boardTone'

/**
 * A board's face in lists, cards and search: its background when it has one,
 * otherwise its initials on its own colour.
 */
const BoardTile = ({ board, size = 28, className }) => {
	const background = board?.background
	return (
		<span
			className={cx('board-tile', background && 'board-tile--background', className)}
			style={{
				'--tile-size': `${size}px`,
				...(background
					? { background: backgroundCss(background, { thumb: true }) }
					: { background: `var(--ui-${toneFor(board?._id)}-soft)`, color: `var(--ui-${toneFor(board?._id)}-soft-text)` }),
			}}
			aria-hidden='true'
		>
			{initialsOf(board?.name || '?')}
		</span>
	)
}

export default BoardTile
