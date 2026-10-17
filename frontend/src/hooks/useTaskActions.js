import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useI18n } from '../i18n'
import { translateServerMessageCurrent } from '../i18n/translate'
import { axiosInstance } from '../lib/axios'
import { useBoardStats } from '../store/useBoardStats'

/**
 * Task actions shared by My tasks and the calendar: tick done (move to the board's
 * last column) with undo, change due date or priority, open a task or its board.
 * Changes show at once and roll back if the server refuses them.
 */
const useTaskActions = ({ setTasks, onChanged }) => {
	const { t } = useI18n()
	const navigate = useNavigate()
	// Where a task was before it was ticked done here, so it can go back.
	const [previousColumns, setPreviousColumns] = useState({})

	const afterChange = () => {
		onChanged?.()
		useBoardStats.getState().load({ force: true })
	}

	const updateTask = async (task, changes, optimistic) => {
		setTasks((current) => current.map((item) => (item._id === task._id ? { ...item, ...optimistic } : item)))
		try {
			await axiosInstance.patch(`/board/tasks/${task._id}`, changes)
			return true
		} catch (error) {
			setTasks((current) => current.map((item) => (item._id === task._id ? task : item)))
			toast.error(translateServerMessageCurrent(error.response?.data?.message, 'myTasks.updateError'))
			return false
		} finally {
			afterChange()
		}
	}

	const reopen = async (task, known) => {
		const previous = known || previousColumns[task._id]
		if (!previous) return
		if (await updateTask(task, { column: previous.column, position: previous.position }, { isDone: false })) {
			setPreviousColumns((current) => {
				const next = { ...current }
				delete next[task._id]
				return next
			})
			toast.success(t('myTasks.reopenToast', { task: task.title }))
		}
	}

	const toggleDone = async (task) => {
		if (task.isDone) {
			reopen(task)
			return
		}
		if (!task.doneColumnId) return
		const previous = { column: task.column?._id || task.column, position: task.position ?? 0 }
		setPreviousColumns((current) => ({ ...current, [task._id]: previous }))
		if (await updateTask(task, { column: task.doneColumnId }, { isDone: true })) {
			toast.success(t('myTasks.doneToast', { task: task.title }), {
				action: { label: t('myTasks.undo'), onClick: () => reopen({ ...task, isDone: true }, previous) },
			})
		}
	}

	const setDueDate = (task, dueDate) => updateTask(task, { dueDate }, { dueDate: dueDate ? `${dueDate}T00:00:00.000Z` : null })
	const setPriority = (task, priority) => updateTask(task, { priority }, { priority })

	const canToggle = (task) => (task.isDone ? Boolean(previousColumns[task._id]) : Boolean(task.doneColumnId))
	const toggleHint = (task) => (task.isDone ? t('myTasks.reopenOnBoard') : t('myTasks.noDoneColumn'))

	const boardIdOf = (task) => task.column?.board?._id || task.column?.board
	const openTask = (task) => {
		const boardId = boardIdOf(task)
		if (boardId) navigate(`/workspaces/${boardId}`, { state: { notificationTaskId: task._id } })
	}
	const openBoard = (task) => {
		const boardId = boardIdOf(task)
		if (boardId) navigate(`/workspaces/${boardId}`)
	}

	return { updateTask, toggleDone, setDueDate, setPriority, canToggle, toggleHint, openTask, openBoard }
}

export default useTaskActions
