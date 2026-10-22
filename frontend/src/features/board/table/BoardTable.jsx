import { Archive, ArrowDown, ArrowUp, ArrowUpDown, CheckCheck, Eye, EyeOff, Flag, ListChecks, Maximize2, Plus, Repeat, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import useIsPhone from '../../../hooks/useIsPhone'
import { useI18n } from '../../../i18n'
import { intlLocale } from '../../../i18n/translate'
import { formatDueDate, getDueDateKey, getDueDateState } from '../../../lib/dueDate'
import { AvatarGroup, Button, EmptyState, IconButton, Input } from '../../../ui'
import { cx } from '../../../ui/utils'
import CardPopover from '../cards/CardPopover'
import { LabelsPicker, MembersPicker } from '../cards/CardPickers'
import { CARD_COLORS, formatDuration } from '../model/cardDisplay'
import { compareRows, tableRows } from './tableModel'
import './board-table.css'

const PAGE = 200
const PRIORITIES = ['none', 'low', 'medium', 'high', 'urgent']
const SORTABLE = [
	['title', 'table.columns.title'],
	['list', 'table.columns.list'],
	['labels', 'table.columns.labels'],
	['members', 'table.columns.members'],
	['start', 'table.columns.start'],
	['due', 'table.columns.due'],
	['priority', 'table.columns.priority'],
	['checklist', 'table.columns.checklist'],
	['time', 'table.columns.time'],
]

/** A title you can change in place: Enter or leaving the cell saves, Escape puts it back. */
const TitleCell = ({ task, canEdit, onSave }) => {
	const [draft, setDraft] = useState(null)
	const value = draft ?? task.title
	const commit = () => {
		const next = value.trim()
		setDraft(null)
		if (next && next !== task.title) onSave(next)
	}
	return (
		<input
			className='bt-input bt-input--title'
			value={value}
			readOnly={!canEdit}
			maxLength={200}
			aria-label={task.title}
			data-i18n-ignore
			onChange={(event) => setDraft(event.target.value)}
			onBlur={commit}
			onKeyDown={(event) => {
				if (event.key === 'Enter') event.currentTarget.blur()
				if (event.key === 'Escape') {
					event.stopPropagation()
					setDraft(null)
					window.requestAnimationFrame(() => event.target.blur())
				}
			}}
		/>
	)
}

/**
 * The board as a table: every card a row, sortable by any column, edited right in the
 * cells. Works with the board's filter, finds cards by title, and changes many cards at
 * once (complete, move, due date, archive). Cards are added at the bottom.
 */
const BoardTable = ({ columns, lastColumnId, cardPasses, labels, people, canEdit, canManageLabels, onPatch, onMove, onMoveMany, onArchiveMany, onOpen, onAddCard, onLabelCreate, onLabelUpdate, onLabelDelete }) => {
	const { t, language } = useI18n()
	const isPhone = useIsPhone()
	const [selecting, setSelecting] = useState(false)
	const [sort, setSort] = useState({ key: null, direction: 'asc' })
	const [query, setQuery] = useState('')
	const [hideDone, setHideDone] = useState(false)
	const [selected, setSelected] = useState([])
	const [limit, setLimit] = useState(PAGE)
	const [picker, setPicker] = useState(null) // { kind: 'labels' | 'members', taskId, anchor }
	const [labelView, setLabelView] = useState(null) // the label form inside the labels picker
	const [newTitle, setNewTitle] = useState('')
	const [newColumnId, setNewColumnId] = useState('')
	const [bulkDue, setBulkDue] = useState('')
	const units = { h: t('card.units.h'), m: t('card.units.m') }
	const labelColor = useMemo(() => new Map(labels.map((label) => [label.name.toLowerCase(), label.color])), [labels])

	const rows = useMemo(() => {
		const all = tableRows(columns, { query, hideDone, passes: cardPasses })
		return sort.key ? [...all].sort((left, right) => compareRows(left, right, sort.key, language, sort.direction === 'asc' ? 1 : -1)) : all
	}, [columns, query, hideDone, cardPasses, sort, language])
	const shown = rows.slice(0, limit)
	const selectedRows = rows.filter((row) => selected.includes(row.task._id))
	const allSelected = shown.length > 0 && shown.every((row) => selected.includes(row.task._id))
	const pickerRow = picker && rows.find((row) => row.task._id === picker.taskId)
	const targetColumnId = newColumnId || columns[0]?._id || ''

	const toggleSort = (key) => setSort((current) => (current.key !== key ? { key, direction: 'asc' } : current.direction === 'asc' ? { key, direction: 'desc' } : { key: null, direction: 'asc' }))
	const toggleRow = (taskId) => setSelected((current) => (current.includes(taskId) ? current.filter((id) => id !== taskId) : [...current, taskId]))
	const toggleAll = () => setSelected(allSelected ? [] : shown.map((row) => row.task._id))
	const memberIds = (task) => (task.assignees || []).map((person) => String(person?._id || person))
	const moveTo = (task, columnId) => {
		const column = columns.find((item) => item._id === columnId)
		if (column && String(task.column) !== columnId) onMove(task._id, columnId, column.tasks.length)
	}
	const bulk = (action) => {
		for (const { task } of selectedRows) action(task)
		setSelected([])
	}
	const addCard = async (event) => {
		event.preventDefault()
		const column = columns.find((item) => item._id === targetColumnId)
		if (!newTitle.trim() || !column) return
		if (await onAddCard(column, newTitle.trim())) setNewTitle('')
	}

	const sortIcon = (key) => (sort.key !== key ? ArrowUpDown : sort.direction === 'asc' ? ArrowUp : ArrowDown)

	const bulkBar = selectedRows.length > 0 && canEdit && (
		<div className='bt-bulk' role='region' aria-label={t('table.bulk', { count: selectedRows.length })}>
			<span className='bt-bulk__count'>{t('table.bulk', { count: selectedRows.length })}</span>
			<Button size='sm' variant='secondary' icon={CheckCheck} className='bt-bulk__done' onClick={() => bulk((task) => !task.completed && onPatch(task, { completed: true }))}>{isPhone ? t('table.markDoneShort') : t('table.markDone')}</Button>
			<select className='bt-select bt-bulk__select' value='' onChange={(event) => { const columnId = event.target.value; if (!columnId) return; onMoveMany(selectedRows.filter(({ task }) => String(task.column) !== columnId).map(({ task }) => task._id), columnId); setSelected([]) }} aria-label={t('table.moveTo')}>
				<option value=''>{t('table.moveTo')}</option>
				{columns.map((column) => <option key={column._id} value={column._id}>{column.title}</option>)}
			</select>
			<span className='bt-bulk__due'>
				<input type='date' className='bt-input bt-input--date' value={bulkDue} onChange={(event) => setBulkDue(event.target.value)} aria-label={t('table.setDue')} />
				<Button size='sm' variant='secondary' disabled={!bulkDue} onClick={() => { bulk((task) => onPatch(task, { dueDate: bulkDue })); setBulkDue('') }}>{t('table.setDue')}</Button>
			</span>
			<Button size='sm' variant='secondary' icon={Archive} className='bt-bulk__archive' onClick={() => { onArchiveMany(selectedRows.map(({ task }) => task)); setSelected([]) }}>{t('table.archive')}</Button>
			<IconButton icon={X} size='sm' label={t('table.clearSelection')} onClick={() => setSelected([])} />
		</div>
	)

	const addForm = canEdit && columns.length > 0 && (
		<form className='bt-add' onSubmit={addCard}>
			<Plus size={16} aria-hidden='true' className='bt-add__icon' />
			<input className='bt-input bt-add__title' value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder={t('table.addPlaceholder')} aria-label={t('table.addPlaceholder')} maxLength={200} />
			<select className='bt-select' value={targetColumnId} onChange={(event) => setNewColumnId(event.target.value)} aria-label={t('table.columns.list')}>
				{columns.map((column) => <option key={column._id} value={column._id}>{column.title}</option>)}
			</select>
			{isPhone ? <Button type='submit' size='sm' icon={Plus} aria-label={t('table.add')} title={t('table.add')} disabled={!newTitle.trim()} /> : <Button type='submit' size='sm' disabled={!newTitle.trim()}>{t('table.add')}</Button>}
		</form>
	)

	// Phones: the same cards as a list of rows, each opening the card; sorting and
	// batch actions stay, editing happens in the card itself.
	if (isPhone) {
		const locale = intlLocale(language)
		return (
			<div className='bt bt--phone'>
				<div className='bt-toolbar'>
					<Input icon={Search} type='search' value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('table.search')} aria-label={t('table.search')} className='bt-search' />
					<div className='bt-phone-tools'>
						<select className='bt-select bt-phone-sort' value={sort.key || ''} onChange={(event) => setSort({ key: event.target.value || null, direction: sort.direction })} aria-label={t('table.sortBy')}>
							<option value=''>{t('table.boardOrder')}</option>
							{SORTABLE.filter(([key]) => key !== 'start').map(([key, label]) => <option key={key} value={key}>{t(label)}</option>)}
						</select>
						<IconButton icon={sort.direction === 'asc' ? ArrowUp : ArrowDown} size='sm' variant='outline' label={sort.direction === 'asc' ? t('table.ascending') : t('table.descending')} disabled={!sort.key} onClick={() => setSort((current) => ({ ...current, direction: current.direction === 'asc' ? 'desc' : 'asc' }))} />
						<IconButton icon={hideDone ? EyeOff : Eye} size='sm' variant='outline' label={hideDone ? t('table.showDone') : t('table.hideDone')} aria-pressed={hideDone} onClick={() => setHideDone((value) => !value)} />
						{canEdit && <IconButton icon={ListChecks} size='sm' variant='outline' label={t('table.selectMode')} aria-pressed={selecting} onClick={() => { setSelecting((value) => !value); setSelected([]) }} />}
					</div>
					<span className='bt-count'>{t('table.count', { count: rows.length })}</span>
				</div>
				{bulkBar}
				<ul className='btm-list'>
					{shown.map(({ task, column }) => {
						const done = Boolean(task.completed)
						const state = task.dueDate && !done ? getDueDateState(task.dueDate) : null
						const people_ = (task.assignees || []).filter((person) => person?._id).map((person) => ({ ...person, name: person.name || person.email }))
						const urgent = task.priority === 'urgent' || task.priority === 'high'
						const isSelected = selected.includes(task._id)
						return (
							<li key={task._id} className={cx('btm-row', done && 'is-done', isSelected && 'is-selected')}>
								{selecting ? (
									<input type='checkbox' className='bt-checkbox btm-row__lead' checked={isSelected} onChange={() => toggleRow(task._id)} aria-label={t('table.select', { title: task.title })} />
								) : (
									<button type='button' className={cx('bt-done btm-row__lead', done && 'is-on')} aria-pressed={done} aria-label={done ? t('planner.markOpen') : t('planner.markDone')} disabled={!canEdit} onClick={() => onPatch(task, { completed: !done })}>
										{done && <CheckCheck size={12} aria-hidden='true' />}
									</button>
								)}
								<button type='button' className='btm-row__body' onClick={() => (selecting ? toggleRow(task._id) : onOpen(task))}>
									<span className='btm-row__title' data-i18n-ignore>{task.title}</span>
									<span className='btm-row__meta'>
										<span className='btm-row__list' data-i18n-ignore>{column.title}</span>
										{task.dueDate && (
											<span className={cx('btm-chip', state && `is-${state}`)}>
												{formatDueDate(task.dueDate, { day: 'numeric', month: 'short' }, locale)}
												{task.repeat?.frequency && <Repeat size={11} aria-hidden='true' />}
											</span>
										)}
										{urgent && <span className={`btm-chip is-${task.priority}`}><Flag size={11} aria-hidden='true' />{t(`myTasks.priority.${task.priority}`)}</span>}
										{(task.labels || []).slice(0, 3).map((name) => <span key={name} className='btm-dot' style={{ background: CARD_COLORS[labelColor.get(name.toLowerCase())] || 'var(--ui-border-strong)' }} title={name} />)}
									</span>
								</button>
								{people_.length > 0 && <span className='btm-row__people'><AvatarGroup people={people_} max={2} size={24} /></span>}
							</li>
						)
					})}
				</ul>
				{!rows.length && <EmptyState icon={Search} title={query || hideDone ? t('table.nothingFound') : t('table.empty')} description={query || hideDone ? undefined : t('table.emptyText')} />}
				{rows.length > limit && <div className='bt-more-rows'><Button variant='secondary' onClick={() => setLimit((value) => value + PAGE)}>{t('table.showMore', { count: Math.min(PAGE, rows.length - limit) })}</Button></div>}
				{addForm}
			</div>
		)
	}

	return (
		<div className='bt'>
			<div className='bt-toolbar'>
				<Input icon={Search} type='search' value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('table.search')} aria-label={t('table.search')} className='bt-search' />
				<Button variant={hideDone ? 'secondary' : 'ghost'} size='sm' icon={hideDone ? EyeOff : Eye} aria-pressed={hideDone} onClick={() => setHideDone((value) => !value)}>
					{hideDone ? t('table.showDone') : t('table.hideDone')}
				</Button>
				<span className='bt-count'>{t('table.count', { count: rows.length })}</span>
			</div>

			{bulkBar}

			<div className='bt-scroll'>
				<table className='bt-table'>
					<thead>
						<tr>
							<th className='bt-col-select'>
								<input type='checkbox' className='bt-checkbox' checked={allSelected} onChange={toggleAll} aria-label={t('table.selectAll')} disabled={!shown.length} />
							</th>
							<th className='bt-col-done'><span className='ui-visually-hidden'>{t('table.columns.done')}</span></th>
							{SORTABLE.map(([key, label]) => {
								const Icon = sortIcon(key)
								return (
									<th key={key} className={`bt-col-${key}`} aria-sort={sort.key === key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
										<button type='button' className={cx('bt-sort', sort.key === key && 'is-active')} onClick={() => toggleSort(key)}>
											<span>{t(label)}</span>
											<Icon size={13} aria-hidden='true' />
										</button>
									</th>
								)
							})}
							<th className='bt-col-open'><span className='ui-visually-hidden'>{t('table.open')}</span></th>
						</tr>
					</thead>
					<tbody>
						{shown.map(({ task, column }) => {
							const done = Boolean(task.completed)
							const checklist = task.checklist || []
							const checked = checklist.filter((item) => item.completed).length
							const people_ = (task.assignees || []).filter((person) => person?._id).map((person) => ({ ...person, name: person.name || person.email }))
							return (
								<tr key={task._id} className={cx(done && 'is-done', selected.includes(task._id) && 'is-selected', column._id === lastColumnId && 'is-last-list')}>
									<td className='bt-col-select'>
										<input type='checkbox' className='bt-checkbox' checked={selected.includes(task._id)} onChange={() => toggleRow(task._id)} aria-label={t('table.select', { title: task.title })} />
									</td>
									<td className='bt-col-done'>
										<button type='button' className={cx('bt-done', done && 'is-on')} aria-pressed={done} aria-label={done ? t('planner.markOpen') : t('planner.markDone')} disabled={!canEdit} onClick={() => onPatch(task, { completed: !done })}>
											{done && <CheckCheck size={12} aria-hidden='true' />}
										</button>
									</td>
									<td className='bt-col-title'><TitleCell key={task.title} task={task} canEdit={canEdit} onSave={(title) => onPatch(task, { title })} /></td>
									<td className='bt-col-list'>
										<select className='bt-select' value={column._id} disabled={!canEdit} onChange={(event) => moveTo(task, event.target.value)} aria-label={t('table.columns.list')}>
											{columns.map((item) => <option key={item._id} value={item._id}>{item.title}</option>)}
										</select>
									</td>
									<td className='bt-col-labels'>
										<button type='button' className='bt-cell-button' disabled={!canEdit} onClick={(event) => setPicker({ kind: 'labels', taskId: task._id, anchor: event.currentTarget })} aria-label={t('card.labels')}>
											{(task.labels || []).length ? (
												(task.labels || []).slice(0, 2).map((name) => (
													<span key={name} className='bt-label' data-i18n-ignore style={{ '--label': CARD_COLORS[labelColor.get(name.toLowerCase())] || 'var(--ui-border-strong)' }}>{name}</span>
												))
											) : <span className='bt-empty'>—</span>}
											{(task.labels || []).length > 2 && <span className='bt-more'>+{task.labels.length - 2}</span>}
										</button>
									</td>
									<td className='bt-col-members'>
										<button type='button' className='bt-cell-button' disabled={!canEdit} onClick={(event) => setPicker({ kind: 'members', taskId: task._id, anchor: event.currentTarget })} aria-label={t('card.members')}>
											{people_.length ? <AvatarGroup people={people_} max={3} size={24} /> : <span className='bt-empty'>—</span>}
										</button>
									</td>
									<td className='bt-col-start'>
										<input type='date' className={cx('bt-input bt-input--date', !task.startDate && 'is-empty')} value={getDueDateKey(task.startDate)} max={getDueDateKey(task.dueDate) || undefined} disabled={!canEdit} onChange={(event) => onPatch(task, { startDate: event.target.value || null })} aria-label={t('table.columns.start')} />
									</td>
									<td className='bt-col-due'>
										<span className='bt-due'>
											<input type='date' className={cx('bt-input bt-input--date', !task.dueDate && 'is-empty')} value={getDueDateKey(task.dueDate)} min={getDueDateKey(task.startDate) || undefined} disabled={!canEdit} onChange={(event) => onPatch(task, { dueDate: event.target.value || null, ...(!event.target.value && task.repeat ? { repeat: null } : {}) })} aria-label={t('table.columns.due')} />
											{task.repeat?.frequency && <Repeat size={13} className='bt-repeat' aria-label={t('repeat.title')} />}
										</span>
									</td>
									<td className='bt-col-priority'>
										<select className={cx('bt-select', `bt-priority--${task.priority || 'none'}`)} value={task.priority || 'none'} disabled={!canEdit} onChange={(event) => onPatch(task, { priority: event.target.value })} aria-label={t('table.columns.priority')}>
											{PRIORITIES.map((value) => <option key={value} value={value}>{t(`myTasks.priority.${value}`)}</option>)}
										</select>
									</td>
									<td className='bt-col-checklist'>
										{checklist.length ? (
											<span className='bt-progress' title={`${checked}/${checklist.length}`}>
												<span className='bt-progress__bar'><span style={{ width: `${(checked / checklist.length) * 100}%` }} /></span>
												<span>{checked}/{checklist.length}</span>
											</span>
										) : <span className='bt-empty'>—</span>}
									</td>
									<td className='bt-col-time'>{task.trackedSeconds ? formatDuration(task.trackedSeconds, units) : <span className='bt-empty'>—</span>}</td>
									<td className='bt-col-open'>
										<IconButton icon={Maximize2} size='sm' label={t('table.openCard', { title: task.title })} onClick={() => onOpen(task)} />
									</td>
								</tr>
							)
						})}
					</tbody>
				</table>
				{!rows.length && (
					<EmptyState icon={Search} title={query || hideDone ? t('table.nothingFound') : t('table.empty')} description={query || hideDone ? undefined : t('table.emptyText')} />
				)}
				{rows.length > limit && (
					<div className='bt-more-rows'>
						<Button variant='secondary' onClick={() => setLimit((value) => value + PAGE)}>{t('table.showMore', { count: Math.min(PAGE, rows.length - limit) })}</Button>
					</div>
				)}
			</div>

			{addForm}

			<CardPopover
				open={Boolean(pickerRow)}
				anchor={picker?.anchor}
				onClose={() => { setPicker(null); setLabelView(null) }}
				onBack={labelView ? () => setLabelView(null) : undefined}
				title={picker?.kind === 'members' ? t('card.members') : labelView?.kind === 'label-form' ? (labelView.label ? t('card.editLabel', { name: labelView.label.name }) : t('card.createLabel')) : t('card.labels')}
			>
				{pickerRow && picker.kind === 'labels' && (
					<LabelsPicker
						labels={labels}
						selected={pickerRow.task.labels || []}
						canEdit={canManageLabels}
						view={labelView}
						setView={setLabelView}
						onCreate={(draft) => onLabelCreate(draft, pickerRow.task)}
						onUpdate={onLabelUpdate}
						onDelete={onLabelDelete}
						onToggle={(name) => {
							const current = pickerRow.task.labels || []
							const has = current.some((label) => label.toLowerCase() === name.toLowerCase())
							onPatch(pickerRow.task, { labels: has ? current.filter((label) => label.toLowerCase() !== name.toLowerCase()) : [...current, name] })
						}}
					/>
				)}
				{pickerRow && picker.kind === 'members' && (
					<MembersPicker
						people={people}
						selected={memberIds(pickerRow.task)}
						onToggle={(id) => {
							const ids = memberIds(pickerRow.task)
							onPatch(pickerRow.task, { assignees: ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id] })
						}}
					/>
				)}
			</CardPopover>
		</div>
	)
}

export default BoardTable
