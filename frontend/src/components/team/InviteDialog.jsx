import { Send } from 'lucide-react'
import { useRef, useState } from 'react'
import { useI18n } from '../../i18n'
import { translateServerMessageCurrent } from '../../i18n/translate'
import { axiosInstance } from '../../lib/axios'
import { Button, Field, Input, Modal, Select } from '../../ui'

/** Send an email invitation to one of the boards I own or administer. */
const InviteDialog = ({ open, onClose, boards, email: presetEmail = '', onSent }) => {
	const { t } = useI18n()
	const emailRef = useRef(null)
	const [email, setEmail] = useState(presetEmail)
	const [boardId, setBoardId] = useState(boards[0]?._id || '')
	const [error, setError] = useState('')
	const [isSending, setIsSending] = useState(false)
	const [wasOpen, setWasOpen] = useState(false)

	if (open !== wasOpen) {
		setWasOpen(open)
		if (open) {
			setEmail(presetEmail)
			setBoardId(boards[0]?._id || '')
			setError('')
		}
	}

	const send = async (event) => {
		event?.preventDefault()
		if (!email.trim() || !boardId || isSending) return
		setIsSending(true)
		setError('')
		try {
			await axiosInstance.post(`/board/boards/${boardId}/invites`, { email: email.trim(), role: 'member' })
			onSent?.(email.trim())
			onClose()
		} catch (requestError) {
			setError(requestError.response?.status === 409
				? t('team.inviteExists', { email: email.trim() })
				: translateServerMessageCurrent(requestError.response?.data?.message, 'team.inviteError'))
		} finally {
			setIsSending(false)
		}
	}

	return (
		<Modal
			open={open}
			onClose={isSending ? undefined : onClose}
			title={t('team.inviteSheetTitle')}
			initialFocusRef={presetEmail ? undefined : emailRef}
			footer={
				<>
					<Button variant='secondary' onClick={onClose} disabled={isSending}>{t('common.cancel')}</Button>
					<Button type='submit' form='tm-invite-form' icon={Send} loading={isSending} disabled={!email.trim() || !boardId}>{t('team.sendInvite')}</Button>
				</>
			}
		>
			<form id='tm-invite-form' className='tm-invite' onSubmit={send} noValidate>
				<Field label={t('team.inviteEmail')} error={error}>
					<Input ref={emailRef} id='tm-invite-email' type='email' value={email} onChange={(event) => setEmail(event.target.value)} placeholder={t('team.inviteEmailPlaceholder')} readOnly={Boolean(presetEmail)} autoComplete='off' />
				</Field>
				<Field label={t('team.addBoard')}>
					<Select id='tm-invite-board' value={boardId} onChange={(event) => setBoardId(event.target.value)} options={boards.map((board) => ({ value: board._id, label: board.name }))} />
				</Field>
			</form>
		</Modal>
	)
}

export default InviteDialog
