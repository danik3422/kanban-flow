import { cx, initialsOf } from '../../ui/utils'
import { backgroundCss } from './backgrounds/boardBackground'
import { boardToneFor as toneFor } from './boardTone'

/**
 * A board's face in lists, cards and search: its background when it has one,
 * otherwise its initials on its own colour. `plain` always uses the colour, for
 * places where the background is already shown next to it.
 */
const BoardTile = ({ board, size = 28, plain = false, className }) => {
	const background = plain ? null : board?.background
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
