import { cx, initialsOf } from '../../ui/utils'

// Same contrast-checked soft pairs as avatars, so every board gets a stable color in both themes.
const TONES = ['accent', 'info', 'orange', 'success', 'warning', 'danger']
const toneFor = (seed = '') => {
	let hash = 0
	for (const character of seed) hash = (hash * 31 + character.charCodeAt(0)) >>> 0
	return TONES[hash % TONES.length]
}

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
