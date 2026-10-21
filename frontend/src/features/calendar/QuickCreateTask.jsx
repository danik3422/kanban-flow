import { Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../i18n'
import { translateServerMessageCurrent } from '../../i18n/translate'
import { axiosInstance } from '../../lib/axios'
import { Button, Checkbox, Field, Input, Modal, Select } from '../../ui'

const LAST_BOARD_KEY = 'kh:last-task-board'
const PRIORITIES = ['none', 'low', 'medium', 'high', 'urgent']

const readLastBoard = () => {
	try {
		return localStorage.getItem(LAST_BOARD_KEY) || ''
	} catch {
		return ''
	}
}

/**
 * Add a task for a date without leaving the calendar: title, board and column
 * (the board's first column by default), due date and priority.
 */
const QuickCreateTask = ({ open, onClose, date, boards, userId, assignMeByDefault = true, onCreated }) => {
	const { t } = useI18n()
	const titleRef = useRef(null)
	const [title, setTitle] = useState('')
	const [boardId, setBoardId] = useState('')
	const [columns, setColumns] = useState([])
	const [columnId, setColumnId] = useState('')
	const [dueDate, setDueDate] = useState(date || '')
	const [priority, setPriority] = useState('none')
	const [assignMe, setAssignMe] = useState(assignMeByDefault)
	const [error, setError] = useState('')
	const [isSaving, setIsSaving] = useState(false)
	const [wasOpen, setWasOpen] = useState(false)

	// Each time the dialog opens: fresh fields, the date that was picked, the last board used.
	if (open !== wasOpen) {
		setWasOpen(open)
		if (open) {
			const remembered = readLastBoard()
			setTitle('')
			setDueDate(date || '')
			setPriority('none')
			setAssignMe(assignMeByDefault)
			setError('')
			setBoardId(boards.some((board) => board._id === remembered) ? remembered : boards[0]?._id || '')
		}
	}

	useEffect(() => {
		if (!open || !boardId) return undefined
		let ignore = false
		axiosInstance.get(`/board/boards/${boardId}/columns`)
			.then(({ data }) => {
				if (ignore) return
				const sorted = (Array.isArray(data) ? data : []).slice().sort((left, right) => (left.position ?? 0) - (right.position ?? 0))
				setColumns(sorted)
				setColumnId(sorted[0]?._id || '')
			})
			.catch(() => {
				if (!ignore) {
					setColumns([])
					setColumnId('')
				}
			})
		return () => {
			ignore = true
		}
	}, [open, boardId])

	const submit = async (event) => {
		event?.preventDefault()
		if (!title.trim() || !columnId || isSaving) return
		setIsSaving(true)
		setError('')
		try {
			await axiosInstance.post(`/board/columns/${columnId}/task`, {
				title: title.trim(),
				dueDate: dueDate || null,
				priority,
				assignees: assignMe && userId ? [userId] : [],
			})
			try {
				localStorage.setItem(LAST_BOARD_KEY, boardId)
			} catch {
				// Only a convenience.
			}
			onCreated?.()
			onClose()
		} catch (requestError) {
			setError(translateServerMessageCurrent(requestError.response?.data?.message, 'calendar.create.error'))
		} finally {
			setIsSaving(false)
		}
	}

	return (
		<Modal
			open={open}
			onClose={isSaving ? undefined : onClose}
			title={t('calendar.create.title')}
			initialFocusRef={titleRef}
			footer={
				<>
					<Button variant='secondary' onClick={onClose} disabled={isSaving}>{t('common.cancel')}</Button>
					<Button type='submit' form='quick-create-task' icon={Plus} loading={isSaving} disabled={!title.trim() || !columnId}>{t('calendar.create.submit')}</Button>
				</>
			}
		>
			<form
				id='quick-create-task'
				className='cal-create'
				onSubmit={submit}
				onKeyDown={(event) => {
					if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) submit(event)
				}}
				noValidate
			>
				<Field label={t('calendar.create.name')} error={error}>
					<Input ref={titleRef} id='cal-task-title' value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t('calendar.create.namePlaceholder')} maxLength={200} autoComplete='off' />
				</Field>
				<div className='cal-create__row'>
					<Field label={t('calendar.create.board')}>
						<Select id='cal-task-board' value={boardId} onChange={(event) => setBoardId(event.target.value)} options={boards.map((board) => ({ value: board._id, label: board.name }))} />
					</Field>
					<Field label={t('calendar.create.column')} hint={boardId && !columns.length ? t('calendar.create.noColumns') : undefined}>
						<Select id='cal-task-column' value={columnId} onChange={(event) => setColumnId(event.target.value)} disabled={!columns.length} options={columns.map((column) => ({ value: column._id, label: column.title }))} />
					</Field>
				</div>
				<div className='cal-create__row'>
					<Field label={t('calendar.create.due')}>
						<Input id='cal-task-due' type='date' value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
					</Field>
					<Field label={t('calendar.create.priority')}>
						<Select id='cal-task-priority' value={priority} onChange={(event) => setPriority(event.target.value)} options={PRIORITIES.map((value) => ({ value, label: t(`myTasks.priority.${value}`) }))} />
					</Field>
				</div>
				<Checkbox label={t('calendar.create.assignMe')} checked={assignMe} onChange={(event) => setAssignMe(event.target.checked)} />
			</form>
		</Modal>
	)
}

export default QuickCreateTask
