import { useState } from 'react'
import { cx, initialsOf } from './utils'

export const Badge = ({ tone = 'neutral', pill = false, dot = false, className, children, ...props }) => (
	<span className={cx('ui-badge', tone !== 'neutral' && `ui-badge--${tone}`, pill && 'ui-badge--pill', className)} {...props}>
		{dot && <span className='ui-badge__dot' aria-hidden='true' />}
		{children}
	</span>
)

// Reuses the contrast-checked soft tone pairs so avatars read well in both themes.
const AVATAR_TONES = ['accent', 'info', 'orange', 'success', 'warning', 'danger']
const toneFor = (seed = '') => {
	let hash = 0
	for (const character of seed) hash = (hash * 31 + character.charCodeAt(0)) >>> 0
	return AVATAR_TONES[hash % AVATAR_TONES.length]
}

const PRESENCE_COLOR = { online: 'var(--ui-success)', away: 'var(--ui-warning-soft-text)' }

export const Avatar = ({ name = '', src, size = 32, status, className, decorative = false }) => {
	const [failedSrc, setFailedSrc] = useState(null)
	const tone = toneFor(name)
	const showImage = src && failedSrc !== src
	return (
		<span
			className={cx('ui-avatar', className)}
			style={{
				'--avatar-size': `${size}px`,
				background: showImage ? 'var(--ui-surface-2)' : `var(--ui-${tone}-soft)`,
				color: `var(--ui-${tone}-soft-text)`,
			}}
			role={decorative ? undefined : 'img'}
			aria-label={decorative ? undefined : name}
			aria-hidden={decorative || undefined}
		>
			{showImage ? <img src={src} alt='' onError={() => setFailedSrc(src)} referrerPolicy='no-referrer' /> : initialsOf(name)}
			{status && <span className='ui-avatar__status' style={{ background: PRESENCE_COLOR[status] }} aria-hidden='true' />}
		</span>
	)
}

export const AvatarGroup = ({ people, max = 3, size = 28, label }) => {
	const visible = people.slice(0, max)
	const hidden = people.length - visible.length
	return (
		<span className='ui-avatar-group' role='img' aria-label={label || people.map((person) => person.name).join(', ')}>
			{visible.map((person) => (
				<Avatar key={person.id || person.name} name={person.name} src={person.avatar} size={size} status={person.status} decorative />
			))}
			{hidden > 0 && (
				<span className='ui-avatar ui-avatar-group__more' style={{ '--avatar-size': `${size}px` }} aria-hidden='true'>+{hidden}</span>
			)}
		</span>
	)
}

export const Card = ({ as: Component = 'div', padded = true, interactive = false, className, children, ...props }) => (
	<Component className={cx('ui-card', padded && 'ui-card--padded', interactive && 'ui-card--interactive', className)} {...props}>
		{children}
	</Component>
)

export const EmptyState = ({ icon: Icon, title, description, action, tone, className }) => (
	<div className={cx('ui-empty', className)}>
		{Icon && (
			<span className={cx('ui-empty__icon', tone === 'danger' && 'ui-empty__icon--danger')} aria-hidden='true'>
				<Icon size={22} />
			</span>
		)}
		<h3 className='ui-empty__title'>{title}</h3>
		{description && <p className='ui-empty__description'>{description}</p>}
		{action && <div className='ui-empty__action'>{action}</div>}
	</div>
)

export const Skeleton = ({ width = '100%', height = 14, radius, className }) => (
	<span className={cx('ui-skeleton', className)} style={{ width, height, borderRadius: radius }} aria-hidden='true' />
)

export const Spinner = ({ size = 18, label }) => (
	<span role={label ? 'status' : undefined} aria-label={label} style={{ display: 'inline-grid', fontSize: size, color: 'var(--ui-link)' }}>
		<span className='ui-spinner' aria-hidden='true' />
	</span>
)

export const PageHeader = ({ eyebrow, title, description, actions, className, titleAs: Title = 'h1' }) => (
	<header className={cx('ui-page-header', className)}>
		<div className='ui-page-header__text'>
			{eyebrow && <span className='ui-page-header__eyebrow'>{eyebrow}</span>}
			<Title className='ui-page-header__title'>{title}</Title>
			{description && <p className='ui-page-header__description'>{description}</p>}
		</div>
		{actions && <div className='ui-page-header__actions'>{actions}</div>}
	</header>
)

export const Alert = ({ tone = 'info', title, icon: Icon, children, className, ...props }) => (
	<div className={cx('ui-alert', tone !== 'info' && `ui-alert--${tone}`, className)} role={tone === 'danger' ? 'alert' : 'status'} {...props}>
		{Icon && <Icon size={18} aria-hidden='true' style={{ flex: '0 0 auto', marginTop: 1 }} />}
		<div>
			{title && <div className='ui-alert__title'>{title}</div>}
			{children}
		</div>
	</div>
)

/** A card label: a colour dot and its name on a light tint of the same colour. */
export const LabelBadge = ({ name, color, className }) => (
	<span className={cx('ui-label', className)} style={{ '--label': color }} data-i18n-ignore>{name}</span>
)
