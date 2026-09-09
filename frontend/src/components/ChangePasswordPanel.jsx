import { CheckCircle2, Circle, Eye, EyeOff, LockKeyhole } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { axiosInstance } from '../lib/axios'
import { isDevAuthBypass } from '../lib/devMode'

const ChangePasswordPanel = () => {
	const [isOpen, setIsOpen] = useState(false)
	const [isRendered, setIsRendered] = useState(false)
	const [isClosing, setIsClosing] = useState(false)
	const [visible, setVisible] = useState({
		current: false,
		next: false,
		confirm: false,
	})
	const [form, setForm] = useState({ current: '', next: '', confirm: '' })
	const [isSaving, setIsSaving] = useState(false)
	const checks = {
		length: form.next.length >= 8,
		uppercase: /[A-Z]/.test(form.next),
		number: /\d/.test(form.next),
		special: /[^A-Za-z0-9]/.test(form.next),
	}
	const score = Object.values(checks).filter(Boolean).length
	const strength = score <= 1 ? 'weak' : score <= 3 ? 'medium' : 'strong'
	const passwordsMatch = form.confirm.length > 0 && form.next === form.confirm
	const mismatch = form.confirm.length > 0 && !passwordsMatch
	const update = (key, value) =>
		setForm((current) => ({ ...current, [key]: value }))
	const toggle = (key) =>
		setVisible((current) => ({ ...current, [key]: !current[key] }))
	const closePanel = () => {
		setIsClosing(true)
		window.setTimeout(() => {
			setIsOpen(false)
			setIsRendered(false)
			setIsClosing(false)
		}, 220)
	}
	const togglePanel = () => {
		if (isOpen) closePanel()
		else {
			setIsRendered(true)
			setIsOpen(true)
		}
	}

	const submit = async (event) => {
		event.preventDefault()
		if (form.next === form.current && form.current.length > 0) {
			toast.error('New password must be different from your current password')
			return
		}
		if (mismatch || score < 4) {
			toast.error(
				mismatch ? 'New passwords do not match' : 'Choose a stronger password',
			)
			return
		}
		setIsSaving(true)
		try {
			if (isDevAuthBypass)
				toast.success('Password change is disabled in demo mode')
			else {
				await axiosInstance.patch('/auth/change-password', {
					currentPassword: form.current,
					newPassword: form.next,
				})
				setForm({ current: '', next: '', confirm: '' })
				closePanel()
				toast.success('Password changed')
			}
		} catch (error) {
			toast.error(error.response?.data?.message || 'Could not change password')
		} finally {
			setIsSaving(false)
		}
	}

	const passwordField = (key, label, placeholder) => (
		<div className='security-password-field'>
			<label htmlFor={`security-${key}`}>{label}</label>
			<div className='auth-input-wrap'>
				<input
					id={`security-${key}`}
					type={visible[key] ? 'text' : 'password'}
					value={form[key]}
					onChange={(event) => update(key, event.target.value)}
					placeholder={placeholder}
					required
					minLength={key !== 'current' ? 8 : undefined}
				/>
				<button
					type='button'
					className='auth-input-action'
					onClick={() => toggle(key)}
					aria-label={
						visible[key]
							? `Hide ${label.toLowerCase()}`
							: `Show ${label.toLowerCase()}`
					}
					title={visible[key] ? 'Hide password' : 'Show password'}
				>
					{visible[key] ? <EyeOff size={16} /> : <Eye size={16} />}
				</button>
			</div>
		</div>
	)

	return (
		<div className='change-password-panel'>
			<button
				type='button'
				className='quiet-button change-password-trigger'
				onClick={togglePanel}
			>
				<LockKeyhole size={16} /> Change password
			</button>
			{isRendered && (
				<form
					className={`security-password-form ${isClosing ? 'is-closing' : ''}`}
					onSubmit={submit}
				>
					{passwordField(
						'current',
						'Current password',
						'Enter current password',
					)}
					{passwordField('next', 'New password', 'Create a strong password')}
					{form.next && (
						<div className={`password-strength ${strength}`}>
							<div className='password-strength-heading'>
								<span>Password strength</span>
								<strong>{strength}</strong>
							</div>
							<div className='password-strength-bars'>
								<span className={score >= 1 ? 'filled' : ''} />
								<span className={score >= 2 ? 'filled' : ''} />
								<span className={score >= 3 ? 'filled' : ''} />
								<span className={score >= 4 ? 'filled' : ''} />
							</div>
							<div className='password-requirements'>
								<span className={checks.length ? 'met' : ''}>
									{checks.length ? (
										<CheckCircle2 size={13} />
									) : (
										<Circle size={13} />
									)}{' '}
									8+ characters
								</span>
								<span className={checks.uppercase ? 'met' : ''}>
									{checks.uppercase ? (
										<CheckCircle2 size={13} />
									) : (
										<Circle size={13} />
									)}{' '}
									Uppercase letter
								</span>
								<span className={checks.number ? 'met' : ''}>
									{checks.number ? (
										<CheckCircle2 size={13} />
									) : (
										<Circle size={13} />
									)}{' '}
									Number
								</span>
								<span className={checks.special ? 'met' : ''}>
									{checks.special ? (
										<CheckCircle2 size={13} />
									) : (
										<Circle size={13} />
									)}{' '}
									Special character
								</span>
							</div>
						</div>
					)}
					{passwordField(
						'confirm',
						'Confirm new password',
						'Repeat new password',
					)}
					{mismatch && (
						<p className='security-password-error'>Passwords do not match.</p>
					)}
					{passwordsMatch && (
						<p className='security-password-success'>
							<CheckCircle2 size={14} /> Passwords match.
						</p>
					)}
					<button type='submit' className='primary-button' disabled={isSaving}>
						{isSaving ? 'Changing...' : 'Save new password'}
					</button>
				</form>
			)}
		</div>
	)
}

export default ChangePasswordPanel
