import { sortTasks } from './taskSorting.js'

// Pure transitions of the board's column state, shared by local edits and
// realtime events so both paths update the board the same way.

const sortColumnTasks = (column, tasks) => sortTasks(tasks, column.sortBy || 'custom')

// Replace an edited task in place; only a column change moves it to the end of the target column.
export const applyTaskUpdate = (columns, updatedTask, targetColumnId) => {
	const isInTarget = columns.some(
		(column) =>
			column._id === targetColumnId &&
			column.tasks.some((task) => task._id === updatedTask._id),
	)
	return columns.map((column) => {
		if (isInTarget) {
			return column._id === targetColumnId
				? {
						...column,
						tasks: column.tasks.map((task) =>
							task._id === updatedTask._id ? updatedTask : task,
						),
					}
				: column
		}
		const tasks = column.tasks.filter((task) => task._id !== updatedTask._id)
		return column._id === targetColumnId
			? { ...column, tasks: [...tasks, updatedTask] }
			: { ...column, tasks }
	})
}

export const addTask = (columns, task) =>
	columns.map((column) =>
		column._id === task.column
			? {
					...column,
					tasks: sortColumnTasks(
						column,
						column.tasks.some((item) => item._id === task._id) ? column.tasks : [...column.tasks, task],
					),
				}
			: column,
	)

export const replaceTask = (columns, task) =>
	columns.map((column) => {
		const withoutTask = column.tasks.filter((item) => item._id !== task._id)
		return column._id === task.column
			? { ...column, tasks: sortColumnTasks(column, [...withoutTask, task]) }
			: { ...column, tasks: withoutTask }
	})

export const removeTask = (columns, taskId) =>
	columns.map((column) => ({
		...column,
		tasks: column.tasks.filter((task) => task._id !== taskId),
	}))

export const setColumnTasks = (columns, columnId, tasks) =>
	columns.map((column) =>
		column._id === columnId ? { ...column, tasks: sortColumnTasks(column, tasks) } : column,
	)

export const mergeColumn = (columns, updatedColumn) =>
	columns.map((column) =>
		column._id === updatedColumn._id ? { ...column, ...updatedColumn } : column,
	)

export const applyColumnSort = (columns, updatedColumn) => {
	const sortType = updatedColumn.sortBy || 'custom'
	return columns.map((column) =>
		column._id === updatedColumn._id
			? { ...column, ...updatedColumn, tasks: sortTasks(column.tasks, sortType) }
			: column,
	)
}

export const addColumn = (columns, createdColumn) =>
	columns.some((column) => column._id === createdColumn._id)
		? columns
		: [...columns, { ...createdColumn, tasks: [] }].sort((a, b) => a.position - b.position)

export const removeColumn = (columns, columnId) =>
	columns.filter((column) => column._id !== columnId)

// The server sends the new column order without tasks; keep the tasks already loaded.
export const applyColumnOrder = (columns, reorderedColumns) =>
	reorderedColumns.map((column) => ({
		...column,
		tasks: columns.find((item) => item._id === column._id)?.tasks || [],
	}))
