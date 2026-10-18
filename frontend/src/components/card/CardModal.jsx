import { AlignLeft, CheckSquare, ChevronDown, Circle, CircleCheck, Clock3, Copy, Eye, EyeOff, Flag, Image as ImageIcon, Link2, MessageSquare, MoreHorizontal, MoveRight, Paperclip, Plus, Tag, Timer, Trash2, UserPlus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import useIsPhone from '../../hooks/useIsPhone'
import { useI18n } from '../../i18n'
import { intlLocale } from '../../i18n/translate'
import { sanitizeDescription } from '../../lib/richText'
import { Avatar, Button, ConfirmDialog, IconButton, Menu, Modal } from '../../ui'
import { cx } from '../../ui/utils'
import { CARD_COLORS, dueTone, labelColorKey } from '../../utils/cardDisplay'
import { formatDueDate } from '../../utils/dueDate'
import RichTextEditor from '../RichTextEditor'
import CardComments from './CardComments'
import CardPopover from './CardPopover'
import { AttachmentPicker, CopyCardPicker, CoverPicker, DatesPicker, LabelsPicker, MembersPicker, MoveCardPicker } from './CardPickers'
import { AttachmentsSection, ChecklistSection, SectionHead, TimeSection } from './CardSections'
import './card-modal.css'

const PRIORITIES = ['none', 'low', 'medium', 'high', 'urgent']

/** The title: a textarea that grows, saved on Enter or when focus leaves. */
const TitleField = ({ value, canEdit, onSave }) => {
	const { t } = useI18n()
	const [draft, setDraft] = useState(value)
	const [wasValue, setWasValue] = useState(value)
	const ref = useRef(null)
	if (wasValue !== value) {
		setWasValue(value)
		setDraft(value)
	}
	useEffect(() => {
		const element = ref.current
		if (!element) return
		element.style.height = 'auto'
		element.style.height = `${element.scrollHeight}px`
	}, [draft])
	const commit = () => {
		const next = draft.replace(/\s+/g, ' ').trim()
		if (!next) setDraft(value)
		else if (next !== value) onSave(next)
	}
	return (
		<textarea
			ref={ref}
			className='cm-title'
			value={draft}
			rows={1}
			readOnly={!canEdit}
			maxLength={200}
			aria-label={t('card.titleLabel')}
			onChange={(event) => setDraft(event.target.value.replace(/\n/g, ''))}
			onBlur={commit}
			onKeyDown={(event) => {
				if (event.key === 'Enter') {
					event.preventDefault()
					event.currentTarget.blur()
				}
				if (event.key === 'Escape' && draft !== value) {
					event.stopPropagation()
					setDraft(value)
				}
			}}
			data-i18n-ignore
		/>
	)
}

/** Description: rendered text; Edit (or a click) opens the editor with Save / Cancel. */
const DescriptionSection = ({ value, canEdit, onSave }) => {
	const { t } = useI18n()
	const [editing, setEditing] = useState(false)
	const [draft, setDraft] = useState(value || '')
	const empty = !value || !value.replace(/<[^>]*>/g, '').trim()
	const open = () => {
		if (!canEdit) return
		setDraft(value || '')
		setEditing(true)
	}
	return (
		<section className='cm-section'>
			<SectionHead icon={AlignLeft} title={t('card.description')}>
				{canEdit && !editing && !empty && <Button variant='secondary' size='sm' onClick={open}>{t('card.edit')}</Button>}
			</SectionHead>
			{editing ? (
				<div className='cm-description-editor'>
					<RichTextEditor value={draft} onChange={setDraft} />
					<div className='cm-row'>
						<Button size='sm' onClick={async () => { await onSave(draft); setEditing(false) }}>{t('card.save')}</Button>
						<Button variant='ghost' size='sm' onClick={() => setEditing(false)}>{t('card.cancel')}</Button>
					</div>
				</div>
			) : empty ? (
				<button type='button' className='cm-description-empty' onClick={open} disabled={!canEdit}>{t('card.descriptionPlaceholder')}</button>
			) : (
				// Sanitized rich text written on this board.
				<div className='cm-description rich-text' onClick={(event) => !event.target.closest('a') && open()} dangerouslySetInnerHTML={{ __html: sanitizeDescription(value) }} />
			)}
		</section>
	)
}

/**
 * A card, Trello-style: which list it is in, its cover and title, quick buttons to
 * add labels, dates, a checklist, members and attachments, then its description,
 * checklist, attachments and time, with comments and history beside it (below a
 * "Comments" button on phones). Every change saves as it is made.
 */
const CardModal = ({
	task,
	columns,
	boardLabels,
	labels,
	people,
	meId,
	canEdit,
	canManage,
	uploads,
	commentsVersion,
	onClose,
	onPatch,
	onMove,
	onCopy,
	onDelete,
	onLabelCreate,
	onLabelUpdate,
	onLabelDelete,
	onAttachLink,
	onAttachImage,
	onRemoveAttachment,
	onToggleWatch,
	onCopyLink,
	taskTitleOf,
}) => {
	const { t, language } = useI18n()
	const isPhone = useIsPhone()
	const [picker, setPicker] = useState(null) // labels | dates | members | attachment | cover | copy | move
	const [pickerView, setPickerView] = useState(null)
	const [showComments, setShowComments] = useState(() => !window.matchMedia('(max-width: 720px)').matches)
	const [addChecklist, setAddChecklist] = useState(false)
	const [confirmDelete, setConfirmDelete] = useState(false)
	// The button a panel opens next to (kept as an element, read only when placing it).
	const [anchor, setAnchor] = useState(null)
	const moreButton = useRef(null)

	const column = columns.find((item) => item._id === String(task.column))
	const lastColumnId = [...columns].sort((a, b) => a.position - b.position).at(-1)?._id
	const done = task.completed || column?._id === lastColumnId
	const tone = dueTone(task, done)
	const memberIds = (task.assignees || []).map((person) => String(person._id || person))
	const watching = (task.watchers || []).some((id) => String(id) === String(meId))
	const cover = task.cover
	const coverStyle = cover ? (cover.type === 'color' ? { background: CARD_COLORS[cover.key] } : { backgroundImage: `url("${cover.url || cover.thumb}")`, backgroundColor: cover.color || '#5b6470' }) : null
	const images = (task.attachments || []).filter((item) => item.kind === 'image')
	const locale = intlLocale(language)

	const open = (name, element) => {
		setAnchor(element || null)
		setPickerView(null)
		setPicker(name)
	}
	const opener = (name) => (event) => open(name, event.currentTarget)
	const close = () => {
		setPicker(null)
		setPickerView(null)
	}
	const toggleLabel = (name) => {
		const has = task.labels.some((label) => label.toLowerCase() === name.toLowerCase())
		onPatch({ labels: has ? task.labels.filter((label) => label.toLowerCase() !== name.toLowerCase()) : [...task.labels, name] })
	}
	const toggleMember = (id) => onPatch({ assignees: memberIds.includes(id) ? memberIds.filter((item) => item !== id) : [...memberIds, id] })

	const pickerTitle = {
		labels: pickerView?.kind === 'label-form' ? (pickerView.label ? t('card.editLabel', { name: pickerView.label.name }) : t('card.createLabel')) : t('card.labels'),
		dates: t('card.dates'),
		members: t('card.members'),
		attachment: t('card.attach'),
		cover: t('card.coverTitle'),
		copy: t('card.copy'),
		move: t('card.move'),
	}[picker]

	const dateText = [task.startDate && formatDueDate(task.startDate, { day: 'numeric', month: 'short' }, locale), task.dueDate && formatDueDate(task.dueDate, { day: 'numeric', month: 'short', year: 'numeric' }, locale)].filter(Boolean).join(' – ')

	const actionButtons = [
		{ key: 'labels', icon: Tag, label: t('card.labels') },
		{ key: 'dates', icon: Clock3, label: t('card.dates') },
		{ key: 'checklist', icon: CheckSquare, label: t('card.checklist') },
		{ key: 'members', icon: UserPlus, label: t('card.members') },
		{ key: 'attachment', icon: Paperclip, label: t('card.attachment') },
	]

	const listMenu = (
		<Menu
			label={t('card.moveToList')}
			align='start'
			trigger={(props) => (
				<button type='button' className='cm-list-button' {...props} aria-label={`${t('card.inList', { list: column?.title || '' })}. ${t('card.moveToList')}`} disabled={!canEdit}>
					<span data-i18n-ignore>{column?.title}</span>
					<ChevronDown size={15} aria-hidden='true' />
				</button>
			)}
			items={columns.map((item) => ({
				label: item.title,
				checked: item._id === column?._id,
				mark: 'end',
				onSelect: () => item._id !== column?._id && onMove(item._id, item.tasks.length),
			}))}
		/>
	)

	const headerActions = (
		<>
			{canEdit && <IconButton icon={ImageIcon} label={t('card.cover')} onClick={opener('cover')} />}
			<Menu
				label={t('card.menu')}
				trigger={(props) => <span ref={moreButton} className='cm-more'><IconButton icon={MoreHorizontal} label={t('card.menu')} {...props} /></span>}
				items={[
					{ label: watching ? t('card.unwatch') : t('card.watch'), icon: watching ? EyeOff : Eye, onSelect: onToggleWatch },
					{ label: t('card.copyLink'), icon: Link2, onSelect: onCopyLink },
					...(canEdit ? [
						{ label: t('card.move'), icon: MoveRight, onSelect: () => open('move', moreButton.current) },
						{ label: t('card.copy'), icon: Copy, onSelect: () => open('copy', moreButton.current) },
						{ separator: true },
						{ label: t('card.delete'), icon: Trash2, tone: 'danger', onSelect: () => setConfirmDelete(true) },
					] : []),
				]}
			/>
		</>
	)

	const main = (
		<div className='cm-main'>
			<div className='cm-title-row'>
				<button
					type='button'
					className={cx('cm-complete', task.completed && 'is-on')}
					aria-pressed={Boolean(task.completed)}
					aria-label={task.completed ? t('card.markIncomplete') : t('card.markComplete')}
					disabled={!canEdit}
					onClick={() => onPatch({ completed: !task.completed })}
				>
					{task.completed ? <CircleCheck size={22} aria-hidden='true' /> : <Circle size={22} aria-hidden='true' />}
				</button>
				<TitleField value={task.title} canEdit={canEdit} onSave={(title) => onPatch({ title })} />
			</div>

			{canEdit && (
				<div className='cm-actions' role='toolbar' aria-label={t('card.addTo')}>
					{actionButtons.map(({ key, icon: Icon, label }) => (
						<Button
							key={key}
							variant='secondary'
							size='sm'
							icon={Icon}
							onClick={(event) => (key === 'checklist' ? setAddChecklist(true) : open(key, event.currentTarget))}
						>
							{label}
						</Button>
					))}
				</div>
			)}

			<div className='cm-meta'>
				{memberIds.length > 0 && (
					<div className='cm-meta__group'>
						<h4 className='cm-subtitle'>{t('card.members')}</h4>
						<div className='cm-meta__row'>
							{(task.assignees || []).filter((person) => person && typeof person === 'object').map((person) => <Avatar key={person._id} name={person.name || person.email} src={person.avatar} size={32} />)}
							{canEdit && <IconButton icon={Plus} size='sm' variant='secondary' label={t('card.members')} onClick={opener('members')} className='cm-round' />}
						</div>
					</div>
				)}
				{task.labels?.length > 0 && (
					<div className='cm-meta__group'>
						<h4 className='cm-subtitle'>{t('card.labels')}</h4>
						<div className='cm-meta__row'>
							{task.labels.map((name) => (
								<button key={name} type='button' className='ct-label cm-label' style={{ '--label': CARD_COLORS[labelColorKey(name, boardLabels)] }} onClick={(event) => canEdit && open('labels', event.currentTarget)} data-i18n-ignore>{name}</button>
							))}
							{canEdit && <IconButton icon={Plus} size='sm' variant='secondary' label={t('card.labels')} onClick={opener('labels')} className='cm-round' />}
						</div>
					</div>
				)}
				{(task.dueDate || task.startDate) && (
					<div className='cm-meta__group'>
						<h4 className='cm-subtitle'>{t('card.dates')}</h4>
						<button type='button' className={cx('cm-date', tone && `ct-due--${tone}`)} onClick={(event) => canEdit && open('dates', event.currentTarget)}>
							<Clock3 size={15} aria-hidden='true' />
							<span>{dateText}</span>
							{tone && tone !== 'later' && <span className='cm-date__state'>{t(`card.due.${tone}`)}</span>}
						</button>
					</div>
				)}
				<div className='cm-meta__group'>
					<h4 className='cm-subtitle'>{t('card.priority')}</h4>
					<Menu
						label={t('card.priority')}
						align='start'
						trigger={(props) => (
							<button type='button' className={cx('cm-chip', task.priority !== 'none' && `ct-priority--${task.priority}`)} {...props} disabled={!canEdit}>
								<Flag size={14} aria-hidden='true' />
								<span>{t(`myTasks.priority.${task.priority || 'none'}`)}</span>
							</button>
						)}
						items={PRIORITIES.map((value) => ({ label: t(`myTasks.priority.${value}`), checked: (task.priority || 'none') === value, mark: 'end', onSelect: () => onPatch({ priority: value }) }))}
					/>
				</div>
				{watching && (
					<div className='cm-meta__group'>
						<h4 className='cm-subtitle'>{t('card.watch')}</h4>
						<button type='button' className='cm-chip is-on' onClick={onToggleWatch}><Eye size={14} aria-hidden='true' />{t('card.watching')}</button>
					</div>
				)}
			</div>

			<DescriptionSection value={task.description} canEdit={canEdit} onSave={(description) => onPatch({ description })} />
			{(task.checklist?.length > 0 || addChecklist) && (
				<ChecklistSection items={task.checklist || []} canEdit={canEdit} autoAdd={addChecklist} onAutoAddDone={() => setAddChecklist(false)} onChange={(checklist) => onPatch({ checklist })} />
			)}
			{task.attachments?.length > 0 && (
				<AttachmentsSection
					attachments={task.attachments}
					meId={meId}
					canManage={canManage}
					onAdd={opener('attachment')}
					onRemove={onRemoveAttachment}
					onMakeCover={(image) => onPatch({ cover: { type: 'photo', id: `attachment-${image._id}`, url: image.url, thumb: image.url, size: cover?.size || 'strip' } })}
				/>
			)}
			<TimeSection task={task} meId={meId} canManage={canManage} taskTitleOf={taskTitleOf} onTaskChange={(fields, save) => (save ? onPatch(fields) : onPatch(fields, { local: true }))} />
		</div>
	)

	return (
		<Modal
			open
			onClose={onClose}
			size='xl'
			className={cx('cm-modal', showComments && !isPhone && 'has-comments')}
			label={t('card.label', { title: task.title })}
			headerStart={listMenu}
			headerActions={headerActions}
		>
			{cover && <div className={cx('cm-cover', cover.size === 'full' && 'is-full')} style={coverStyle} aria-hidden='true' />}
			<div className={cx('cm-layout', showComments && 'with-comments', isPhone && showComments && 'is-comments-view')}>
				{!(isPhone && showComments) && main}
				{showComments && (
					<aside className='cm-side' aria-label={t('card.commentsTitle')}>
						<CardComments task={task} meId={meId} canManage={canManage} version={commentsVersion} />
					</aside>
				)}
			</div>
			<div className='cm-dock'>
				<button type='button' className={cx('cm-dock__button', showComments && 'is-on')} aria-pressed={showComments} onClick={() => setShowComments((value) => !value)}>
					<MessageSquare size={17} aria-hidden='true' />
					<span>{t('card.commentsDock')}</span>
					{task.commentCount > 0 && <span className='cm-dock__count'>{task.commentCount}</span>}
				</button>
			</div>

			<CardPopover open={Boolean(picker)} anchor={anchor} onClose={close} onBack={pickerView ? () => setPickerView(null) : undefined} title={pickerTitle} width={picker === 'cover' ? 340 : 304}>
				{picker === 'labels' && (
					<LabelsPicker labels={labels} selected={task.labels || []} onToggle={toggleLabel} onCreate={onLabelCreate} onUpdate={onLabelUpdate} onDelete={onLabelDelete} view={pickerView} setView={setPickerView} />
				)}
				{picker === 'dates' && (
					<DatesPicker startDate={task.startDate} dueDate={task.dueDate} onSave={async (fields) => { await onPatch(fields); close() }} onRemove={async () => { await onPatch({ startDate: null, dueDate: null }); close() }} />
				)}
				{picker === 'members' && <MembersPicker people={people} selected={memberIds} onToggle={toggleMember} />}
				{picker === 'attachment' && (
					<AttachmentPicker uploads={uploads} onLink={async (url, name) => { const ok = await onAttachLink(url, name); if (ok) close(); return ok }} onImage={async (image, name) => { const ok = await onAttachImage(image, name); if (ok) close(); return ok }} />
				)}
				{picker === 'cover' && <CoverPicker cover={cover} images={images} onChange={(next) => onPatch({ cover: next })} />}
				{picker === 'copy' && <CopyCardPicker task={task} columns={columns} onCopy={async (payload) => { const ok = await onCopy(payload); if (ok) close() }} />}
				{picker === 'move' && <MoveCardPicker task={task} columns={columns} onMove={(columnId, index) => { onMove(columnId, index); close() }} />}
			</CardPopover>

			<ConfirmDialog
				open={confirmDelete}
				onClose={() => setConfirmDelete(false)}
				onConfirm={async () => { setConfirmDelete(false); await onDelete() }}
				title={t('card.deleteTitle', { title: task.title })}
				description={t('card.deleteText')}
				confirmLabel={t('card.delete')}
			/>
		</Modal>
	)
}

export default CardModal
