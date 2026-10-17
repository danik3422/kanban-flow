import { Eye, EyeOff } from 'lucide-react'
import { cloneElement, forwardRef, isValidElement, useId, useState } from 'react'
import { useI18n } from '../i18n'
import { IconButton } from './Button'
import { cx } from './utils'

/**
 * Label, hint and error around one control. The control receives the id and the
 * aria wiring automatically, so every field is announced correctly.
 */
export const Field = ({ label, hint, error, optional = false, children, className }) => {
	const { t } = useI18n()
	const id = useId()
	const hintId = hint ? `${id}-hint` : undefined
	const errorId = error ? `${id}-error` : undefined
	const control = isValidElement(children)
		? cloneElement(children, {
				id: children.props.id || id,
				'aria-invalid': error ? 'true' : children.props['aria-invalid'],
				'aria-describedby': [children.props['aria-describedby'], errorId, hintId].filter(Boolean).join(' ') || undefined,
			})
		: children
	return (
		<div className={cx('ui-field', className)}>
			{label && (
				<label className='ui-field__label' htmlFor={children?.props?.id || id}>
					{label}
					{optional && <span className='ui-field__optional'>{t('common.optional')}</span>}
				</label>
			)}
			{control}
			{error ? (
				<p className='ui-field__error' id={errorId} role='alert'>{error}</p>
			) : (
				hint && <p className='ui-field__hint' id={hintId}>{hint}</p>
			)}
		</div>
	)
}

export const Input = forwardRef(function Input({ icon: Icon, action, className, ...props }, ref) {
	const input = <input ref={ref} className={cx('ui-control', className)} {...props} />
	if (!Icon && !action) return input
	return (
		<div className='ui-input-group'>
			{Icon && <span className='ui-input-group__icon' aria-hidden='true'><Icon size={17} /></span>}
			{input}
			{action && <span className='ui-input-group__action'>{action}</span>}
		</div>
	)
})

export const PasswordInput = forwardRef(function PasswordInput(props, ref) {
	const { t } = useI18n()
	const [visible, setVisible] = useState(false)
	return (
		<Input
			ref={ref}
			type={visible ? 'text' : 'password'}
			{...props}
			action={
				<IconButton
					icon={visible ? EyeOff : Eye}
					label={visible ? t('common.hidePassword') : t('common.showPassword')}
					size='sm'
					onClick={() => setVisible((value) => !value)}
				/>
			}
		/>
	)
})

export const Textarea = forwardRef(function Textarea({ className, ...props }, ref) {
	return <textarea ref={ref} className={cx('ui-control', className)} {...props} />
})

export const Select = forwardRef(function Select({ className, options, children, ...props }, ref) {
	return (
		<select ref={ref} className={cx('ui-control', className)} {...props}>
			{options
				? options.map((option) => (
						<option key={option.value} value={option.value}>{option.label}</option>
					))
				: children}
		</select>
	)
})

export const Checkbox = forwardRef(function Checkbox({ label, className, ...props }, ref) {
	return (
		<label className={cx('ui-check', className)}>
			<input ref={ref} type='checkbox' className='ui-check__box' {...props} />
			{label && <span>{label}</span>}
		</label>
	)
})

export const Switch = forwardRef(function Switch({ label, description, className, ...props }, ref) {
	return (
		<label className={cx('ui-switch', className)}>
			<span className='ui-switch__text'>
				<span className='ui-switch__label'>{label}</span>
				{description && <span className='ui-switch__description'>{description}</span>}
			</span>
			<input ref={ref} type='checkbox' role='switch' className='ui-switch__input' {...props} />
		</label>
	)
})

/** A small set of mutually exclusive options (view switcher, theme picker). */
export const SegmentedControl = ({ options, value, onChange, label, block = false, className }) => (
	<div className={cx('ui-segmented', block && 'ui-segmented--block', className)} role='radiogroup' aria-label={label}>
		{options.map((option) => {
			const Icon = option.icon
			return (
				<button
					key={option.value}
					type='button'
					role='radio'
					aria-checked={value === option.value}
					className='ui-segmented__option'
					onClick={() => onChange(option.value)}
				>
					{Icon && <Icon size={15} aria-hidden='true' />}
					{option.label}
				</button>
			)
		})}
	</div>
)

/** A single choice shown as cards: icon, title and a one-line explanation per option. */
export const RadioCards = ({ legend, name, options, value, onChange, className }) => (
	<fieldset className={cx('ui-radio-cards', className)}>
		{legend && <legend className='ui-field__label'>{legend}</legend>}
		{options.map((option) => {
			const Icon = option.icon
			return (
				<label key={option.value} className={cx('ui-radio-card', value === option.value && 'is-selected')}>
					<input type='radio' name={name} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} />
					{Icon && <span className='ui-radio-card__icon' aria-hidden='true'><Icon size={18} /></span>}
					<span className='ui-radio-card__text'>
						<span className='ui-radio-card__title'>{option.label}</span>
						{option.description && <span className='ui-radio-card__description'>{option.description}</span>}
					</span>
				</label>
			)
		})}
	</fieldset>
)

/** Toggle chip for filters. */
export const Chip = ({ pressed, children, className, ...props }) => (
	<button type='button' aria-pressed={pressed} className={cx('ui-chip', className)} {...props}>
		{children}
	</button>
)
