import { AlertTriangle, ArrowDown, ArrowUp, CalendarClock, Lightbulb, MoreHorizontal, Pencil, Play, Plus, Trash2, X, Zap } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useI18n } from '../../../i18n'
import { intlLocale, translateServerMessageCurrent } from '../../../i18n/translate'
import { axiosInstance } from '../../../lib/axios'
import { weekdayNames } from '../../../lib/calendarDates'
import { relativeTime } from '../../../lib/relativeTime'
import { Avatar, Button, Checkbox, Chip, ConfirmDialog, EmptyState, Field, IconButton, Input, Menu, Modal, Select, Skeleton, Switch, Textarea } from '../../../ui'
import { cx } from '../../../ui/utils'
import { CARD_COLORS } from '../model/cardDisplay'
import {
	actionsFor,
	blankAction,
	blankRule,
	describeRule,
	draftOf,
	FREQUENCIES,
	freshIdeas,
	ideasFor,
	isSchedule,
	listRequired,
	MAX_ACTIONS,
	PRIORITIES,
	problemsOf,
	toPayload,
	CARD_TRIGGERS,
} from './ruleModel'
import './automation.css'

const DAYS = [1, 2, 3, 4, 5, 6, 7]
const MONTH_DAYS = Array.from({ length: 31 }, (_, index) => index + 1)

/** People picked by tapping their chips. */
const PeoplePicker = ({ members, value, onChange, label }) => (
	<div className='am-chips' role='group' aria-label={label}>
		{members.map((person) => (
			<Chip key={person._id} pressed={value.includes(String(person._id))} onClick={() => onChange(value.includes(String(person._id)) ? value.filter((id) => id !== String(person._id)) : [...value, String(person._id)])}>
				<Avatar name={person.name || person.email} src={person.avatar} size={20} decorative />
				<span data-i18n-ignore>{person.name || person.email}</span>
			</Chip>
		))}
	</div>
)

const LabelPicker = ({ labels, value, onChange, label }) => (
	<div className='am-chips' role='group' aria-label={label}>
		{labels.map((item) => (
			<Chip key={item.name} pressed={value.includes(item.name)} onClick={() => onChange(value.includes(item.name) ? value.filter((name) => name !== item.name) : [...value, item.name])}>
				<span className='am-dot' style={{ '--dot': CARD_COLORS[item.color] || CARD_COLORS.gray }} aria-hidden='true' />
				<span data-i18n-ignore>{item.name}</span>
			</Chip>
		))}
	</div>
)

/** The settings of one action, by its type. */
const ActionFields = ({ action, onChange, board }) => {
	const { t } = useI18n()
	const set = (patch) => onChange({ ...action, ...patch })
	const listOptions = board.columns.map((column) => ({ value: column._id, label: column.title }))
	const withPick = (options) => (options.some((option) => option.value === '') ? options : [{ value: '', label: t('automation.needList') }, ...options])
	const listSelect = (key, label) => (
		<Field label={label}>
			<Select value={action[key] || ''} onChange={(event) => set({ [key]: event.target.value })} options={withPick(listOptions)} />
		</Field>
	)
	const positionSelect = (
		<Field label={t('automation.positionLabel')}>
			<Select value={action.position || 'bottom'} onChange={(event) => set({ position: event.target.value })} options={['bottom', 'top'].map((value) => ({ value, label: t(`automation.position.${value}`) }))} />
		</Field>
	)
	switch (action.type) {
		case 'move':
			return <div className='am-fields am-fields--two'>{listSelect('column', t('automation.to'))}{positionSelect}</div>
		case 'add_label':
		case 'remove_label':
			return board.labels.length ? (
				<div className='am-fields'>
					<Field label={t('automation.label')}>
						<Select value={action.label || ''} onChange={(event) => set({ label: event.target.value })} options={board.labels.map((item) => ({ value: item.name, label: item.name }))} />
					</Field>
				</div>
			) : <p className='am-note'>{t('automation.noLabels')}</p>
		case 'assign':
			return <PeoplePicker members={board.members} value={action.users || []} onChange={(users) => set({ users })} label={t('automation.people')} />
		case 'set_due':
			return (
				<div className='am-fields am-fields--narrow'>
					<Field label={t('automation.dueDays')} hint={t('automation.dueDaysHint')}>
						<Input type='number' min={0} max={365} inputMode='numeric' value={action.days ?? 0} onChange={(event) => set({ days: event.target.value === '' ? '' : Math.max(0, Math.min(365, Number(event.target.value))) })} />
					</Field>
				</div>
			)
		case 'set_priority':
			return (
				<div className='am-fields am-fields--narrow'>
					<Field label={t('automation.priority')}>
						<Select value={action.priority} onChange={(event) => set({ priority: event.target.value })} options={PRIORITIES.map((value) => ({ value, label: t(`myTasks.priority.${value}`) }))} />
					</Field>
				</div>
			)
		case 'comment':
			return (
				<Field label={t('automation.commentText')}>
					<Textarea rows={2} maxLength={1000} value={action.text || ''} placeholder={t('automation.commentPlaceholder')} onChange={(event) => set({ text: event.target.value })} />
				</Field>
			)
		case 'create_card':
			return (
				<div className='am-fields'>
					<Field label={t('automation.cardTitle')} hint={t('automation.cardTitleHint')}>
						<Input value={action.title || ''} maxLength={200} placeholder={t('automation.cardTitlePlaceholder')} onChange={(event) => set({ title: event.target.value })} />
					</Field>
					<div className='am-fields am-fields--two'>{listSelect('column', t('automation.list'))}{positionSelect}</div>
					{board.labels.length > 0 && (
						<div className='am-sub'>
							<span className='am-sub__label'>{t('automation.labels')}</span>
							<LabelPicker labels={board.labels} value={action.labels || []} onChange={(labels) => set({ labels })} label={t('automation.labels')} />
						</div>
					)}
					<div className='am-sub'>
						<span className='am-sub__label'>{t('automation.people')}</span>
						<PeoplePicker members={board.members} value={action.users || []} onChange={(users) => set({ users })} label={t('automation.people')} />
					</div>
					<div className='am-due'>
						<Checkbox checked={action.days !== null && action.days !== undefined} onChange={(event) => set({ days: event.target.checked ? 0 : null })} label={t('automation.withDue')} />
						{action.days !== null && action.days !== undefined && (
							<Field label={t('automation.dueDays')} hint={t('automation.dueDaysHint')} className='am-due__days'>
								<Input type='number' min={0} max={365} inputMode='numeric' value={action.days} onChange={(event) => set({ days: event.target.value === '' ? '' : Math.max(0, Math.min(365, Number(event.target.value))) })} />
							</Field>
						)}
					</div>
				</div>
			)
		case 'move_list':
			return <div className='am-fields am-fields--two'>{listSelect('from', t('automation.from'))}{listSelect('column', t('automation.to'))}</div>
		case 'archive_list':
			return (
				<div className='am-fields'>
					{listSelect('column', t('automation.list'))}
					<Checkbox checked={Boolean(action.onlyDone)} onChange={(event) => set({ onlyDone: event.target.checked })} label={t('automation.onlyDone')} />
				</div>
			)
		default:
			return null
	}
}

/** "When … then …": the rule editor. */
const RuleEditor = ({ draft, setDraft, board, problems, showProblems, timezone }) => {
	const { t, language } = useI18n()
	const { trigger } = draft
	const schedule = trigger.schedule
	const days = weekdayNames(language, 1, 'short')
	const setTrigger = (patch) => setDraft((current) => ({ ...current, trigger: { ...current.trigger, ...patch } }))
	const setSchedule = (patch) => setTrigger({ schedule: { ...schedule, ...patch } })
	const changeType = (type) => setDraft((current) => {
		const wasSchedule = current.trigger.type === 'schedule'
		const toSchedule = type === 'schedule'
		const column = listRequired(type) ? current.trigger.column || board.columns.at(-1)?._id || null : current.trigger.column
		const next = { ...current, trigger: { ...current.trigger, type, column: toSchedule ? null : column, schedule: current.trigger.schedule || { frequency: 'weekdays', days: [1], dayOfMonth: 1, time: '09:00' } } }
		// Card actions and board actions do not mix: switching sides starts the actions over.
		if (wasSchedule !== toSchedule) next.actions = [blankAction(toSchedule ? 'create_card' : 'complete', board)]
		return next
	})
	const setAction = (index, action) => setDraft((current) => ({ ...current, actions: current.actions.map((item, at) => (at === index ? action : item)) }))
	const moveAction = (index, step) => setDraft((current) => {
		const actions = [...current.actions]
		const [item] = actions.splice(index, 1)
		actions.splice(index + step, 0, item)
		return { ...current, actions }
	})
	const allowed = actionsFor(trigger.type)
	const error = (key) => (showProblems && problems[key] ? t(problems[key]) : undefined)

	return (
		<div className='am-editor'>
			<Field label={t('automation.name')} hint={t('automation.nameHint')} optional>
				<Input value={draft.name} maxLength={80} placeholder={t('automation.namePlaceholder')} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
			</Field>

			<section className='am-block' aria-labelledby='am-when'>
				<h3 className='am-block__title' id='am-when'><span className='am-block__badge'>{t('automation.when')}</span></h3>
				<div className='am-fields am-fields--two'>
					<Field label={t('automation.triggerLabel')}>
						<Select value={trigger.type} onChange={(event) => changeType(event.target.value)} options={[...CARD_TRIGGERS, 'schedule'].map((value) => ({ value, label: t(`automation.trigger.${value}`) }))} />
					</Field>
					{trigger.type !== 'schedule' && (
						<Field label={t('automation.inList')} error={error('trigger')}>
							<Select
								value={trigger.column || ''}
								onChange={(event) => setTrigger({ column: event.target.value || null })}
								options={[...(listRequired(trigger.type) ? [{ value: '', label: t('automation.needList') }] : [{ value: '', label: t('automation.anyList') }]), ...board.columns.map((column) => ({ value: column._id, label: column.title }))]}
							/>
						</Field>
					)}
					{trigger.type === 'schedule' && (
						<Field label={t('automation.frequencyLabel')}>
							<Select value={schedule.frequency} onChange={(event) => setSchedule({ frequency: event.target.value })} options={FREQUENCIES.map((value) => ({ value, label: t(`automation.frequency.${value}`) }))} />
						</Field>
					)}
				</div>
				{trigger.type === 'schedule' && (
					<div className='am-schedule'>
						{schedule.frequency === 'weekly' && (
							<div className='am-sub'>
								<span className='am-sub__label'>{t('automation.days')}</span>
								<div className='am-days' role='group' aria-label={t('automation.days')}>
									{DAYS.map((day) => (
										<Chip key={day} pressed={schedule.days.includes(day)} onClick={() => setSchedule({ days: schedule.days.includes(day) ? schedule.days.filter((value) => value !== day) : [...schedule.days, day] })}>
											{days[day - 1]}
										</Chip>
									))}
								</div>
								{error('trigger') && <span className='am-error'>{error('trigger')}</span>}
							</div>
						)}
						<div className='am-fields am-fields--two'>
							{schedule.frequency === 'monthly' && (
								<Field label={t('automation.dayOfMonth')} hint={Number(schedule.dayOfMonth) > 28 ? t('automation.dayOfMonthHint') : undefined}>
									<Select value={String(schedule.dayOfMonth)} onChange={(event) => setSchedule({ dayOfMonth: Number(event.target.value) })} options={MONTH_DAYS.map((day) => ({ value: String(day), label: String(day) }))} />
								</Field>
							)}
							<Field label={t('automation.time')} hint={t('automation.timezoneHint', { zone: timezone || 'UTC' })}>
								<Input type='time' value={schedule.time} step={300} onChange={(event) => event.target.value && setSchedule({ time: event.target.value })} lang={intlLocale(language)} />
							</Field>
						</div>
					</div>
				)}
			</section>

			<section className='am-block' aria-labelledby='am-then'>
				<h3 className='am-block__title' id='am-then'><span className='am-block__badge am-block__badge--then'>{t('automation.then')}</span></h3>
				<ol className='am-actions'>
					{draft.actions.map((action, index) => (
						<li key={index} className={cx('am-action', showProblems && problems[index] && 'has-error')}>
							<div className='am-action__head'>
								<span className='am-action__number' aria-hidden='true'>{index + 1}</span>
								<Select
									aria-label={t('automation.actionNumber', { number: index + 1 })}
									className='am-action__type'
									value={action.type}
									onChange={(event) => setAction(index, blankAction(event.target.value, board))}
									options={allowed.map((value) => ({ value, label: t(`automation.action.${value}`) }))}
								/>
								<span className='am-action__tools'>
									{draft.actions.length > 1 && index > 0 && <IconButton icon={ArrowUp} size='sm' label={t('automation.moveUp')} onClick={() => moveAction(index, -1)} />}
									{draft.actions.length > 1 && index < draft.actions.length - 1 && <IconButton icon={ArrowDown} size='sm' label={t('automation.moveDown')} onClick={() => moveAction(index, 1)} />}
									{draft.actions.length > 1 && <IconButton icon={X} size='sm' label={t('automation.removeAction', { number: index + 1 })} onClick={() => setDraft((current) => ({ ...current, actions: current.actions.filter((_, at) => at !== index) }))} />}
								</span>
							</div>
							<ActionFields action={action} board={board} onChange={(next) => setAction(index, next)} />
							{showProblems && problems[index] && <span className='am-error' role='alert'>{t(problems[index])}</span>}
						</li>
					))}
				</ol>
				{draft.actions.length < MAX_ACTIONS && (
					<Button variant='ghost' size='sm' icon={Plus} onClick={() => setDraft((current) => ({ ...current, actions: [...current.actions, blankAction(isSchedule(current) ? 'create_card' : 'set_due', board)] }))}>
						{t('automation.addAction')}
					</Button>
				)}
			</section>
			<p className='am-note'>{t('automation.chainHint')}</p>
		</div>
	)
}

// In the rule's own time zone, so "at 09:00" reads 09:00 wherever the reader is.
const nextRunText = (rule, language) => {
	const options = { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
	try {
		return new Intl.DateTimeFormat(intlLocale(language), { ...options, timeZone: rule.trigger.schedule?.timezone || undefined }).format(new Date(rule.nextRunAt))
	} catch {
		return new Intl.DateTimeFormat(intlLocale(language), options).format(new Date(rule.nextRunAt))
	}
}

/** One saved rule: what it does in words, how it has been doing, and its switch. */
const RuleRow = ({ rule, board, busy, onToggle, onEdit, onRun, onDelete }) => {
	const { t, language } = useI18n()
	const weekdays = useMemo(() => weekdayNames(language, 1, 'short'), [language])
	const { when, then } = describeRule(t, rule, { columns: board.columns, members: board.members, weekdays })
	const nextRun = rule.enabled && rule.nextRunAt
		? nextRunText(rule, language)
		: null
	const author = rule.createdBy?.name || rule.createdBy?.email
	const Icon = isSchedule(rule) ? CalendarClock : Zap
	return (
		<li className={cx('am-rule', !rule.enabled && 'is-off')} data-rule={rule._id}>
			<span className='am-rule__icon' aria-hidden='true'><Icon size={18} /></span>
			<div className='am-rule__body'>
				{rule.name && <span className='am-rule__name' data-i18n-ignore>{rule.name}</span>}
				<p className='am-rule__text'>
					<span className='am-rule__when'>{when}</span>
					<span className='am-rule__arrow' aria-hidden='true'> → </span>
					<span className='am-rule__then'>{then.join(', ')}</span>
				</p>
				<p className='am-rule__meta'>
					{!rule.enabled ? t('automation.paused') : rule.runs ? t('automation.runs', { count: rule.runs }) : t('automation.never')}
					{rule.enabled && rule.runs > 0 && rule.lastRunAt && <> · {t('automation.lastRun', { time: relativeTime(rule.lastRunAt, language, t('boards.justNow')) })}</>}
					{nextRun && <> · {t('automation.nextRun', { time: nextRun })}</>}
					{author && <> · <span data-i18n-ignore>{t('automation.by', { name: author })}</span></>}
				</p>
				{rule.lastError && t(`automation.skipped.${rule.lastError}`) !== `automation.skipped.${rule.lastError}` && (
					<p className='am-rule__warning'><AlertTriangle size={14} aria-hidden='true' /> {t(`automation.skipped.${rule.lastError}`)}</p>
				)}
			</div>
			<div className='am-rule__controls'>
				<Switch className='am-rule__switch' label={<span className='ui-visually-hidden'>{t('automation.toggle')}: {rule.name || when}</span>} checked={rule.enabled} disabled={!rule.canEdit || busy} onChange={(event) => onToggle(rule, event.target.checked)} />
				{rule.canEdit ? (
					<Menu
						label={t('automation.more')}
						trigger={(props) => <IconButton {...props} icon={MoreHorizontal} size='sm' label={t('automation.more')} />}
						items={[
							{ label: t('automation.edit'), icon: Pencil, onSelect: () => onEdit(rule) },
							...(isSchedule(rule) ? [{ label: t('automation.runNow'), icon: Play, onSelect: () => onRun(rule), disabled: busy }] : []),
							{ label: t('automation.delete'), icon: Trash2, tone: 'danger', onSelect: () => onDelete(rule) },
						]}
					/>
				) : <span className='am-rule__spacer' title={t('automation.readOnly')} />}
			</div>
		</li>
	)
}

/**
 * Board automation: the rules of the board, ideas that fit it, and the editor.
 * `version` changes when someone else changes the rules (realtime), so the list reloads.
 */
const AutomationDialog = ({ open, onClose, boardId, columns = [], labels = [], members = [], timezone, version = 0 }) => {
	const { t } = useI18n()
	const [rules, setRules] = useState(null)
	const [view, setView] = useState('list')
	const [editing, setEditing] = useState(null)
	const [draft, setDraft] = useState(null)
	const [showProblems, setShowProblems] = useState(false)
	const [saving, setSaving] = useState(false)
	const [busyId, setBusyId] = useState(null)
	const [deleting, setDeleting] = useState(null)
	const [wasOpen, setWasOpen] = useState(open)
	if (wasOpen !== open) {
		setWasOpen(open)
		if (open) {
			setView('list')
			setDraft(null)
		}
	}
	const board = useMemo(() => ({ columns: columns.map((column) => ({ _id: String(column._id), title: column.title })), labels, members }), [columns, labels, members])

	const load = useCallback(() => {
		if (!boardId) return
		axiosInstance.get(`/board/boards/${boardId}/rules`)
			.then(({ data }) => setRules(data))
			.catch((error) => {
				setRules((current) => current || [])
				toast.error(translateServerMessageCurrent(error.response?.data?.message, 'automation.title'))
			})
	}, [boardId])
	useEffect(() => {
		if (open) load()
	}, [open, load])
	// Someone else changed the rules: reload, even while closed, so it never opens stale.
	useEffect(() => {
		if (version) load()
	}, [version, load])

	const startNew = (kind) => {
		setEditing(null)
		setDraft(blankRule(kind, board))
		setShowProblems(false)
		setView('edit')
	}
	const startIdea = (idea) => {
		setEditing(null)
		setDraft(draftOf(idea.rule))
		setShowProblems(false)
		setView('edit')
	}
	const startEdit = (rule) => {
		setEditing(rule)
		setDraft(draftOf(rule))
		setShowProblems(false)
		setView('edit')
	}
	const problems = draft ? problemsOf(draft) : {}
	const save = async (event) => {
		event?.preventDefault()
		if (Object.keys(problems).length) {
			setShowProblems(true)
			return
		}
		setSaving(true)
		try {
			const payload = toPayload(draft)
			const { data } = editing
				? await axiosInstance.put(`/board/boards/${boardId}/rules/${editing._id}`, payload)
				: await axiosInstance.post(`/board/boards/${boardId}/rules`, payload)
			setRules((current) => (editing ? (current || []).map((rule) => (rule._id === data._id ? data : rule)) : [...(current || []), data]))
			toast.success(t('automation.saved'))
			setView('list')
		} catch (error) {
			toast.error(translateServerMessageCurrent(error.response?.data?.message, 'automation.title'))
		} finally {
			setSaving(false)
		}
	}
	const toggle = async (rule, enabled) => {
		setBusyId(rule._id)
		setRules((current) => current.map((item) => (item._id === rule._id ? { ...item, enabled } : item)))
		try {
			const { data } = await axiosInstance.patch(`/board/boards/${boardId}/rules/${rule._id}`, { enabled })
			setRules((current) => current.map((item) => (item._id === data._id ? data : item)))
			toast.success(t(enabled ? 'automation.turnedOn' : 'automation.turnedOff'), { id: 'rule-toggle' })
		} catch (error) {
			setRules((current) => current.map((item) => (item._id === rule._id ? rule : item)))
			toast.error(translateServerMessageCurrent(error.response?.data?.message, 'automation.title'))
		} finally {
			setBusyId(null)
		}
	}
	const run = async (rule) => {
		setBusyId(rule._id)
		try {
			const { data } = await axiosInstance.post(`/board/boards/${boardId}/rules/${rule._id}/run`)
			setRules((current) => current.map((item) => (item._id === data.rule._id ? data.rule : item)))
			toast.success(t(data.created || data.moved || data.rule.runs > rule.runs ? 'automation.ran' : 'automation.ranNothing'))
		} catch (error) {
			toast.error(translateServerMessageCurrent(error.response?.data?.message, 'automation.title'))
		} finally {
			setBusyId(null)
		}
	}
	const remove = async () => {
		const rule = deleting
		setBusyId(rule._id)
		try {
			await axiosInstance.delete(`/board/boards/${boardId}/rules/${rule._id}`)
			setRules((current) => current.filter((item) => item._id !== rule._id))
			toast.success(t('automation.deleted'))
			setDeleting(null)
		} catch (error) {
			toast.error(translateServerMessageCurrent(error.response?.data?.message, 'automation.title'))
		} finally {
			setBusyId(null)
		}
	}

	const cardRules = (rules || []).filter((rule) => !isSchedule(rule))
	const scheduleRules = (rules || []).filter(isSchedule)
	const ideas = rules ? freshIdeas(ideasFor(t, board.columns), rules) : []
	const rowProps = { board, onToggle: toggle, onEdit: startEdit, onRun: run, onDelete: setDeleting }
	const group = (title, items) => items.length > 0 && (
		<section className='am-group'>
			<h3 className='am-group__title'>{title}</h3>
			<ul className='am-rules'>
				{items.map((rule) => <RuleRow key={rule._id} rule={rule} busy={busyId === rule._id} {...rowProps} />)}
			</ul>
		</section>
	)

	return (
		<>
			<Modal
				open={open}
				onClose={onClose}
				onBack={view === 'edit' ? () => setView('list') : undefined}
				size='lg'
				className='am-modal'
				title={view === 'edit' ? t(editing ? 'automation.editTitle' : 'automation.newTitle') : t('automation.title')}
				description={view === 'list' ? t('automation.intro') : undefined}
				footer={view === 'edit' ? (
					<>
						<Button variant='secondary' onClick={() => setView('list')} disabled={saving}>{t('automation.cancel')}</Button>
						<Button onClick={save} loading={saving}>{t('automation.save')}</Button>
					</>
				) : (
					<>
						<Button variant='secondary' icon={CalendarClock} onClick={() => startNew('schedule')}>{t('automation.scheduleRules')}</Button>
						<Button icon={Plus} onClick={() => startNew('card')} disabled={!board.columns.length}>{t('automation.add')}</Button>
					</>
				)}
			>
				{view === 'edit' && draft && (
					<form onSubmit={save}>
						<RuleEditor draft={draft} setDraft={setDraft} board={board} problems={problems} showProblems={showProblems} timezone={timezone} />
					</form>
				)}
				{view === 'list' && (
					rules === null ? (
						<div className='am-loading'><Skeleton height={76} radius={14} /><Skeleton height={76} radius={14} /></div>
					) : (
						<div className='am-list'>
							{!rules.length && <EmptyState icon={Zap} title={t('automation.empty')} description={t('automation.emptyText')} />}
							{group(t('automation.cardRules'), cardRules)}
							{group(t('automation.scheduleRules'), scheduleRules)}
							{ideas.length > 0 && (
								<section className='am-group am-ideas'>
									<h3 className='am-group__title'><Lightbulb size={14} aria-hidden='true' /> {t('automation.ideas')}</h3>
									<p className='am-note'>{t('automation.ideasHint')}</p>
									<ul className='am-ideas__list'>
										{ideas.map((idea) => (
											<li key={idea.key}>
												<button type='button' className='am-idea' onClick={() => startIdea(idea)}>
													{isSchedule(idea.rule) ? <CalendarClock size={16} aria-hidden='true' /> : <Zap size={16} aria-hidden='true' />}
													<span>{idea.title}</span>
												</button>
											</li>
										))}
									</ul>
								</section>
							)}
						</div>
					)
				)}
			</Modal>
			<ConfirmDialog
				open={Boolean(deleting)}
				onClose={() => setDeleting(null)}
				onConfirm={remove}
				loading={Boolean(deleting) && busyId === deleting?._id}
				title={t('automation.deleteTitle')}
				description={t('automation.deleteText')}
				confirmLabel={t('automation.delete')}
			/>
		</>
	)
}

export default AutomationDialog
