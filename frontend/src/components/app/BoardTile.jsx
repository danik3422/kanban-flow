import { cx, initialsOf } from '../../ui/utils'
import { boardToneFor as toneFor } from '../../utils/boardTone'

/** A board's initials on its own color: the board's face in lists, cards and search. */
const BoardTile = ({ board, size = 28, className }) => (
	<span
		className={cx('board-tile', className)}
		style={{
			'--tile-size': `${size}px`,
			background: `var(--ui-${toneFor(board?._id)}-soft)`,
			color: `var(--ui-${toneFor(board?._id)}-soft-text)`,
		}}
		aria-hidden='true'
	>
		{initialsOf(board?.name || '?')}
	</span>
)

export default BoardTile
