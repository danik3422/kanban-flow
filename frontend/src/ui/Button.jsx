import { forwardRef } from 'react'

import { cx } from './utils'

/**
 * The one button of the app. `as` renders it as another element (e.g. a router
 * Link) while keeping the look; `loading` disables it and shows a spinner.
 */
export const Button = forwardRef(function Button(
	{
		as: Component = 'button',
		variant = 'primary',
		size = 'md',
		block = false,
		loading = false,
		icon: Icon,
		iconRight: IconRight,
		className,
		children,
		disabled,
		type,
		...props
	},
	ref,
) {
	const isButton = Component === 'button'
	return (
		<Component
			ref={ref}
			type={isButton ? type || 'button' : type}
			className={cx('ui-btn', `ui-btn--${variant}`, size !== 'md' && `ui-btn--${size}`, block && 'ui-btn--block', className)}
			disabled={isButton ? disabled || loading : undefined}
			aria-disabled={!isButton && (disabled || loading) ? 'true' : undefined}
			aria-busy={loading || undefined}
			{...props}
		>
			{loading ? <span className='ui-spinner' aria-hidden='true' /> : Icon && <Icon size={size === 'sm' ? 15 : 17} aria-hidden='true' />}
			{children}
			{IconRight && !loading && <IconRight size={size === 'sm' ? 15 : 17} aria-hidden='true' />}
		</Component>
	)
})

/** Icon-only button; `label` is required because it is the accessible name. */
export const IconButton = forwardRef(function IconButton(
	{ as: Component = 'button', icon: Icon, label, size = 'md', variant = 'ghost', badge = false, className, type, ...props },
	ref,
) {
	return (
		<Component
			ref={ref}
			type={Component === 'button' ? type || 'button' : type}
			className={cx('ui-icon-btn', size !== 'md' && `ui-icon-btn--${size}`, variant !== 'ghost' && `ui-icon-btn--${variant}`, className)}
			aria-label={label}
			title={label}
			{...props}
		>
			<Icon size={size === 'sm' ? 16 : 18} aria-hidden='true' />
			{badge && <span className='ui-icon-btn__badge' aria-hidden='true' />}
		</Component>
	)
})
