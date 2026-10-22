import { Archive, Columns3, FileJson, MessageSquare, SquareKanban, Tag, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { useI18n } from '../../../i18n'
import { translateServerMessageCurrent } from '../../../i18n/translate'
import { axiosInstance } from '../../../lib/axios'
import { Button, Field, Input, Modal } from '../../../ui'
import { cx } from '../../../ui/utils'
import { importPayload, parseBoardFile } from './parseBoardFile'
import './import-board.css'

// Trello's JSON export can be large (its history comes along); the board itself is much smaller.
const MAX_FILE_BYTES = 60 * 1024 * 1024
const MAX_PAYLOAD_BYTES = 9.5 * 1024 * 1024

/**
 * Bring a board in from a Trello JSON export or a KanbanHub export: pick or drop the
 * file, check what it holds, name the board and import it as a new private board.
 */
const ImportBoardDialog = ({ open, onClose, onImported }) => {
	const { t } = useI18n()
	const inputRef = useRef(null)
	const [board, setBoard] = useState(null)
	const [name, setName] = useState('')
	const [error, setError] = useState('')
	const [isOver, setIsOver] = useState(false)
	const [busy, setBusy] = useState(false)

	const [wasOpen, setWasOpen] = useState(open)
	if (wasOpen !== open) {
		setWasOpen(open)
		if (open) {
			setBoard(null)
			setError('')
			setBusy(false)
		}
	}

	const read = async (file) => {
		if (!file) return
		setError('')
		if (file.size > MAX_FILE_BYTES) {
			setError(t('import.errors.tooLarge'))
			return
		}
		try {
			const parsed = parseBoardFile(await file.text())
			setBoard(parsed)
			setName(parsed.name)
		} catch (failure) {
			setBoard(null)
			setError(t(`import.errors.${failure.code || 'json'}`))
		}
	}

	const submit = async (event) => {
		event.preventDefault()
		if (!board || !name.trim() || busy) return
		const body = importPayload(board, { name: name.trim() })
		if (new Blob([JSON.stringify(body)]).size > MAX_PAYLOAD_BYTES) {
			setError(t('import.errors.tooLarge'))
			return
		}
		setBusy(true)
		setError('')
		try {
			const { data } = await axiosInstance.post('/board/boards/import', body, { timeout: 120_000 })
			onImported(data)
		} catch (failure) {
			setError(translateServerMessageCurrent(failure.response?.data?.message, 'import.errors.failed'))
			setBusy(false)
		}
	}

	const facts = board ? [
		{ icon: Columns3, label: t('import.facts.lists', { count: board.summary.lists }) },
		{ icon: SquareKanban, label: t('import.facts.cards', { count: board.summary.cards }) },
		{ icon: Tag, label: t('import.facts.labels', { count: board.summary.labels }) },
		{ icon: MessageSquare, label: t('import.facts.comments', { count: board.summary.comments }) },
		...(board.summary.archived ? [{ icon: Archive, label: t('import.facts.archived', { count: board.summary.archived }) }] : []),
	] : []

	return (
		<Modal
			open={open}
			onClose={busy ? undefined : onClose}
			title={t('import.title')}
			description={t('import.description')}
			className='import-dialog'
			footer={board ? (
				<>
					<Button variant='secondary' onClick={() => setBoard(null)} disabled={busy}>{t('import.another')}</Button>
					<Button type='submit' form='import-board-form' icon={Upload} loading={busy} disabled={!name.trim()}>{busy ? t('import.importing') : t('import.submit')}</Button>
				</>
			) : undefined}
		>
			{!board ? (
				<div className='import'>
					<button
						type='button'
						className={cx('import-drop', isOver && 'is-over')}
						onClick={() => inputRef.current?.click()}
						onDragOver={(event) => {
							event.preventDefault()
							setIsOver(true)
						}}
						onDragLeave={() => setIsOver(false)}
						onDrop={(event) => {
							event.preventDefault()
							setIsOver(false)
							read(event.dataTransfer.files?.[0])
						}}
					>
						<span className='import-drop__icon' aria-hidden='true'><FileJson size={24} /></span>
						<span className='import-drop__title'>{t('import.choose')}</span>
						<span className='import-drop__hint'>{t('import.chooseHint')}</span>
					</button>
					<input ref={inputRef} type='file' accept='application/json,.json' hidden onChange={(event) => { read(event.target.files?.[0]); event.target.value = '' }} />
					{error && <p className='import-error' role='alert'>{error}</p>}
					<div className='import-help'>
						<h3>{t('import.trelloTitle')}</h3>
						<ol>
							<li>{t('import.trello1')}</li>
							<li>{t('import.trello2')}</li>
							<li>{t('import.trello3')}</li>
						</ol>
						<p>{t('import.kanbanhub')}</p>
					</div>
				</div>
			) : (
				<form id='import-board-form' className='import' onSubmit={submit} noValidate>
					<div className='import-summary'>
						<span className='import-summary__source'>{t(`import.sources.${board.source}`)}</span>
						<ul className='import-facts'>
							{facts.map(({ icon: Icon, label }) => <li key={label}><Icon size={16} aria-hidden='true' />{label}</li>)}
						</ul>
					</div>
					<Field label={t('import.name')}>
						<Input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} autoComplete='off' />
					</Field>
					<p className='import-note'>{t('import.note')}</p>
					{error && <p className='import-error' role='alert'>{error}</p>}
				</form>
			)}
		</Modal>
	)
}

export default ImportBoardDialog
