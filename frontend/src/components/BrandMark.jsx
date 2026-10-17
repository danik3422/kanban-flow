import './brand-mark.css'

/**
 * The KanbanHub mark: a "K" drawn from kanban cards — a column, a card in the
 * middle and two on the right, the top one tinted as the card being moved.
 * Colors come from CSS variables so it can sit on the page or on the brand panel.
 */
export const LogoMark = ({ size = 32, className }) => (
	<svg className={['logo-mark', className].filter(Boolean).join(' ')} width={size} height={size} viewBox='0 0 32 32' aria-hidden='true' focusable='false'>
		<rect className='logo-mark__tile' width='32' height='32' rx='8' />
		<rect className='logo-mark__glyph' x='6' y='6' width='5' height='20' rx='2' />
		<rect className='logo-mark__glyph' x='13' y='13' width='6' height='6' rx='2' />
		<rect className='logo-mark__glyph' x='19' y='21' width='7' height='5' rx='2' />
		<rect className='logo-mark__moving' x='19' y='6' width='7' height='5' rx='2' />
	</svg>
)

// The logo: mark plus word, used in every header.
const BrandMark = ({ compact = false }) => (
	<span className='brand-lockup'>
		<LogoMark />
		{!compact && <span className='brand-lockup__word'>KanbanHub</span>}
	</span>
)

export default BrandMark
