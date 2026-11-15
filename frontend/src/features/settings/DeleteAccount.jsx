import { Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useI18n } from '../../i18n'
import { translateServerMessageCurrent } from '../../i18n/translate'
import { useAuthStore } from '../../store/useAuthStore'
import { Button, ConfirmDialog, Field, PasswordInput } from '../../ui'

const WRONG_PASSWORD = ['Current password is incorrect', 'Re-authentication failed.', 'Re-authentication required.']

/**
 * Deleting the account: boards only this person uses go, shared boards keep their work.
 * Boards they own with others must be handed over (Share → Owner) or deleted first.
 */
const DeleteAccount = () => {
	const { t } = useI18n()
	const navigate = useNavigate()
	const { authUser, deleteAccount, reauthenticateWithProvider } = useAuthStore()
	const hasPassword = Boolean(authUser?.hasPassword) || (authUser?.provider || 'local') === 'local'
	const [open, setOpen] = useState(false)
	const [password, setPassword] = useState('')
	const [error, setError] = useState('')
	const [sharedBoards, setSharedBoards] = useState([])
	const [isBusy, setIsBusy] = useState(false)
	const passwordRef = useRef(null)

	const show = () => {
		setPassword('')
		setError('')
		setSharedBoards([])
		setOpen(true)
	}

	const confirm = async () => {
		if (isBusy) return
		if (hasPassword && !password) {
			setError(t('settings.password.currentRequired'))
			return
		}
		setIsBusy(true)
		try {
			// Without a password, the person signs in with their provider once more.
			if (!hasPassword && !(await reauthenticateWithProvider())) return
			await deleteAccount(hasPassword ? password : undefined)
			setOpen(false)
			toast.success(t('settings.deleteAccount.done'))
			navigate('/', { replace: true })
		} catch (failure) {
			const data = failure.response?.data || {}
			if (data.code === 'owns_shared_boards') setSharedBoards(data.boards || [])
			else if (WRONG_PASSWORD.includes(data.message)) setError(translateServerMessageCurrent('Re-authentication failed.'))
			else toast.error(translateServerMessageCurrent(data.message, 'settings.deleteAccount.error'))
		} finally {
			setIsBusy(false)
		}
	}

	return (
		<>
			<ul className='st-card st-delete'>
				<li className='st-row st-row--stack'>
					<span className='st-row__lead'>
						<span className='st-row__icon' aria-hidden='true'><Trash2 size={16} /></span>
						<span className='st-row__text'>
							<span className='st-row__title'>{t('settings.deleteAccount.title')}</span>
							<span className='st-row__description'>{t('settings.deleteAccount.text')}</span>
						</span>
					</span>
					<span className='st-row__control'>
						<Button variant='ghost' size='sm' className='st-ghost-danger' data-action='delete-account' onClick={show}>
							{t('settings.deleteAccount.button')}
						</Button>
					</span>
				</li>
			</ul>

			<ConfirmDialog
				open={open}
				onClose={() => !isBusy && setOpen(false)}
				onConfirm={confirm}
				loading={isBusy}
				tone='danger'
				title={t('settings.deleteAccount.dialogTitle')}
				description={t('settings.deleteAccount.dialogText')}
				confirmLabel={t('settings.deleteAccount.confirm')}
				initialFocusRef={hasPassword ? passwordRef : undefined}
			>
				<form className='st-dialog' onSubmit={(event) => { event.preventDefault(); confirm() }}>
					{sharedBoards.length > 0 && (
						<div className='st-delete__shared' role='alert'>
							<p>{t('settings.deleteAccount.sharedBoards')}</p>
							<ul>
								{sharedBoards.map((name, index) => <li key={`${index}-${name}`} data-i18n-ignore>{name}</li>)}
							</ul>
						</div>
					)}
					{hasPassword && (
						<Field label={t('settings.password.current')} error={error}>
							<PasswordInput
								ref={passwordRef}
								id='st-delete-password'
								value={password}
								onChange={(event) => {
									setPassword(event.target.value)
									setError('')
								}}
								autoComplete='current-password'
							/>
						</Field>
					)}
				</form>
			</ConfirmDialog>
		</>
	)
}

export default DeleteAccount
