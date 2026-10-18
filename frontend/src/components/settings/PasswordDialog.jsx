import { useState } from 'react'
import { toast } from 'sonner'
import { PasswordRules } from '../auth/AuthParts'
import { useI18n } from '../../i18n'
import { translateServerMessageCurrent } from '../../i18n/translate'
import { axiosInstance } from '../../lib/axios'
import { Button, Field, Modal, PasswordInput } from '../../ui'
import { meetsPasswordRules } from '../../utils/password'

const EMPTY = { current: '', next: '', repeat: '' }

/**
 * Change the password, or add one to an account that signs in only with a
 * provider (that path re-confirms with the provider through the auth store).
 */
const PasswordDialog = ({ open, mode, providerLabel, onClose, onAddPassword }) => {
	const { t } = useI18n()
	const [form, setForm] = useState(EMPTY)
	const [errors, setErrors] = useState({})
	const [isSaving, setIsSaving] = useState(false)
	const [wasOpen, setWasOpen] = useState(open)
	if (wasOpen !== open) {
		setWasOpen(open)
		if (open) {
			setForm(EMPTY)
			setErrors({})
		}
	}
	const isAdd = mode === 'add'

	const update = (key) => (event) => {
		const { value } = event.target
		setForm((current) => ({ ...current, [key]: value }))
		setErrors((current) => ({ ...current, [key]: '' }))
	}

	const submit = async (event) => {
		event.preventDefault()
		if (isSaving) return
		const nextErrors = {
			current: !isAdd && !form.current ? t('settings.password.currentRequired') : '',
			next: !meetsPasswordRules(form.next) ? t('auth.errors.passwordRules') : !isAdd && form.next === form.current ? t('settings.password.same') : '',
			repeat: !form.repeat ? t('auth.errors.confirmRequired') : form.repeat !== form.next ? t('auth.errors.passwordsMismatch') : '',
		}
		if (Object.values(nextErrors).some(Boolean)) {
			setErrors(nextErrors)
			return
		}
		setIsSaving(true)
		try {
			if (isAdd) {
				const result = await onAddPassword(form.next)
				if (result?.success) onClose()
			} else {
				await axiosInstance.patch('/auth/change-password', { currentPassword: form.current, newPassword: form.next })
				toast.success(t('settings.password.changed'))
				onClose()
			}
		} catch (error) {
			const message = error.response?.data?.message
			if (message === 'Current password is incorrect') setErrors({ current: translateServerMessageCurrent(message) })
			else toast.error(translateServerMessageCurrent(message, 'auth.errors.generic'))
		} finally {
			setIsSaving(false)
		}
	}

	return (
		<Modal
			open={open}
			onClose={isSaving ? undefined : onClose}
			title={isAdd ? t('settings.password.addTitle') : t('settings.password.changeTitle')}
			description={isAdd ? t('settings.password.addText', { provider: providerLabel }) : t('settings.password.changeText')}
			size='sm'
			footer={
				<>
					<Button variant='secondary' onClick={onClose} disabled={isSaving}>{t('common.cancel')}</Button>
					<Button type='submit' form='st-password-form' loading={isSaving}>{t('settings.password.save')}</Button>
				</>
			}
		>
			<form id='st-password-form' className='st-dialog' onSubmit={submit} noValidate>
				{!isAdd && (
					<Field label={t('settings.password.current')} error={errors.current}>
						<PasswordInput id='st-password-current' value={form.current} onChange={update('current')} autoComplete='current-password' autoFocus />
					</Field>
				)}
				<Field label={t('settings.password.next')} error={errors.next}>
					<PasswordInput id='st-password-next' value={form.next} onChange={update('next')} autoComplete='new-password' autoFocus={isAdd} aria-describedby='st-password-rules' />
				</Field>
				<PasswordRules password={form.next} id='st-password-rules' />
				<Field label={t('settings.password.repeat')} error={errors.repeat}>
					<PasswordInput id='st-password-repeat' value={form.repeat} onChange={update('repeat')} autoComplete='new-password' />
				</Field>
			</form>
		</Modal>
	)
}

export default PasswordDialog
