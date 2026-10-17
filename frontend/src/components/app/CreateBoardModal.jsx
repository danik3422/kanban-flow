import { Globe, Lock, Plus, Users } from 'lucide-react'
import { useRef, useState } from 'react'
import { useI18n } from '../../i18n'
import { Button, ConfirmDialog, Field, Input, Modal, RadioCards } from '../../ui'

const VISIBILITY_ICONS = { private: Lock, workspace: Users, public: Globe }

/**
 * Name a board and choose who can open it. Making it public asks once more,
 * because a public board is visible to anyone with its link.
 */
const CreateBoardModal = ({ open, onClose, name, onNameChange, visibility, onVisibilityChange, onSubmit, isSubmitting, error }) => {
	const { t } = useI18n()
	const nameRef = useRef(null)
	const [isConfirmingPublic, setIsConfirmingPublic] = useState(false)

	const chooseVisibility = (value) => {
		if (value === 'public') setIsConfirmingPublic(true)
		else onVisibilityChange(value)
	}

	return (
		<>
			<Modal
				open={open && !isConfirmingPublic}
				onClose={isSubmitting ? undefined : onClose}
				title={t('boards.create.title')}
				description={t('boards.create.description')}
				initialFocusRef={nameRef}
				footer={
					<>
						<Button variant='secondary' onClick={onClose} disabled={isSubmitting}>{t('common.cancel')}</Button>
						<Button type='submit' form='create-board-form' icon={Plus} loading={isSubmitting} disabled={!name.trim()}>
							{isSubmitting ? t('boards.create.creating') : t('boards.create.submit')}
						</Button>
					</>
				}
			>
				<form
					id='create-board-form'
					className='create-board-form'
					onSubmit={(event) => {
						event.preventDefault()
						if (name.trim() && !isSubmitting) onSubmit()
					}}
					noValidate
				>
					<Field label={t('boards.create.name')} error={error}>
						<Input
							ref={nameRef}
							id='board-name'
							value={name}
							onChange={(event) => onNameChange(event.target.value)}
							placeholder={t('boards.create.namePlaceholder')}
							maxLength={100}
							autoComplete='off'
						/>
					</Field>
					<RadioCards
						legend={t('boards.create.access')}
						name='board-visibility'
						value={visibility}
						onChange={chooseVisibility}
						options={['private', 'workspace', 'public'].map((value) => ({
							value,
							icon: VISIBILITY_ICONS[value],
							label: t(`boards.visibility.${value}`),
							description: t(`boards.create.${value}Hint`),
						}))}
					/>
				</form>
			</Modal>
			<ConfirmDialog
				open={isConfirmingPublic}
				onClose={() => setIsConfirmingPublic(false)}
				onConfirm={() => {
					onVisibilityChange('public')
					setIsConfirmingPublic(false)
				}}
				title={t('boards.create.publicTitle')}
				description={t('boards.create.publicText')}
				confirmLabel={t('boards.create.publicConfirm')}
				tone='primary'
			/>
		</>
	)
}

export default CreateBoardModal
