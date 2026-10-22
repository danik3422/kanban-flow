import { Check, ImagePlus, Link2, Loader2, Pencil, Repeat, Search } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { useI18n } from '../../../i18n'
import { Avatar, Button, Checkbox, Field, Input, Select } from '../../../ui'
import { cx } from '../../../ui/utils'
import { addDaysToKey, getDueDateKey, getLocalDateKey } from '../../../lib/dueDate'
import { CARD_COLORS, CARD_COLOR_KEYS } from '../model/cardDisplay'
import { describeRepeat, FREQUENCIES, nextOccurrence, weekdayChoices, weekdayOfKey } from '../model/recurrence'
import { BackgroundSwatch } from '../../boards/backgrounds/BackgroundPicker'
import { usePhotoSearch } from '../../boards/backgrounds/usePhotoSearch'
import { assetUrl } from '../../../lib/runtimeConfig'
import { useServerConfig } from '../../../lib/serverConfig'
import { intlLocale, translateServerMessageCurrent } from '../../../i18n/translate'
import { prepareBackgroundImage } from '../../boards/backgrounds/prepareBackgroundImage'

const ColorSwatches = ({ value, onChange, label }) => {
	const { t } = useI18n()
	return (
		<div className='cp-swatches' role='radiogroup' aria-label={label}>
			{CARD_COLOR_KEYS.map((key) => (
				<button key={key} type='button' role='radio' aria-checked={value === key} aria-label={t(`columns.colors.${key}`)} className={cx('cp-swatch', value === key && 'is-selected')} style={{ '--swatch': CARD_COLORS[key] }} onClick={() => onChange(key)}>
					{value === key && <Check size={14} aria-hidden='true' />}
				</button>
			))}
		</div>
	)
}

/** Board labels: tick to put one on the card, the pencil (board admins) to rename or recolour, or make a new one. */
export const LabelsPicker = ({ labels, selected, canEdit, onToggle, onCreate, onUpdate, onDelete, view, setView }) => {
	const { t } = useI18n()
	const [query, setQuery] = useState('')
	const [draft, setDraft] = useState({ name: '', color: 'green' })
	const [busy, setBusy] = useState(false)
	const needle = query.trim().toLowerCase()
	const shown = labels.filter((label) => !needle || label.name.toLowerCase().includes(needle))

	if (view?.kind === 'label-form') {
		const editing = view.label
		const submit = async (event) => {
			event.preventDefault()
			if (!draft.name.trim()) return
			setBusy(true)
			const ok = editing ? await onUpdate(editing, draft) : await onCreate(draft)
			setBusy(false)
			if (ok) setView(null)
		}
		return (
			<form className='cp-form' onSubmit={submit}>
				<div className='cp-label-preview'><span className='ct-label cp-label-chip' style={{ '--label': CARD_COLORS[draft.color] }} data-i18n-ignore>{draft.name || ' '}</span></div>
				<Field label={t('card.labelName')}>
					<Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} maxLength={40} />
				</Field>
				<ColorSwatches value={draft.color} onChange={(color) => setDraft({ ...draft, color })} label={t('card.labelColor')} />
				<div className='cp-form__actions'>
					<Button type='submit' loading={busy} disabled={!draft.name.trim()}>{editing ? t('card.save') : t('card.createLabel')}</Button>
					{editing?.saved && <Button variant='ghost' className='cp-danger' onClick={async () => { setBusy(true); await onDelete(editing); setBusy(false); setView(null) }}>{t('card.deleteLabel')}</Button>}
				</div>
				{editing?.saved && <p className='cp-hint'>{t('card.deleteLabelText')}</p>}
			</form>
		)
	}

	return (
		<div className='cp-stack'>
			<Input icon={Search} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('card.searchLabels')} aria-label={t('card.searchLabels')} />
			<ul className='cp-list'>
				{shown.map((label) => {
					const on = selected.some((name) => name.toLowerCase() === label.name.toLowerCase())
					return (
						<li key={label.name} className='cp-label-row'>
							<Checkbox checked={on} onChange={() => onToggle(label.name)} label={<span className='ct-label cp-label-chip' style={{ '--label': CARD_COLORS[label.color] }} data-i18n-ignore>{label.name}</span>} />
							{canEdit && (
								<button type='button' className='cp-icon-button' aria-label={t('card.editLabel', { name: label.name })} onClick={() => { setDraft({ name: label.name, color: label.color }); setView({ kind: 'label-form', label }) }}>
									<Pencil size={14} aria-hidden='true' />
								</button>
							)}
						</li>
					)
				})}
				{!shown.length && <li className='cp-hint'>{t('card.noLabelsFound')}</li>}
			</ul>
			<Button variant='secondary' block onClick={() => { setDraft({ name: query.trim(), color: 'green' }); setView({ kind: 'label-form' }) }}>{t('card.createLabel')}</Button>
		</div>
	)
}

/** Start and due dates, with quick picks for the usual "today / tomorrow / next week". */
/**
 * Start and due dates, and how the card repeats: every day, on weekdays, on chosen
 * days of the week, every month or year, every N of them, optionally until a date.
 * A repeating card needs a due date; the next date is shown before saving.
 */
export const DatesPicker = ({ startDate, dueDate, repeat, onSave, onRemove }) => {
	const { t, language } = useI18n()
	const [start, setStart] = useState(getDueDateKey(startDate) || '')
	const [due, setDue] = useState(getDueDateKey(dueDate) || '')
	const [useStart, setUseStart] = useState(Boolean(startDate))
	const [useDue, setUseDue] = useState(Boolean(dueDate) || !startDate)
	const [frequency, setFrequency] = useState(repeat?.frequency || '')
	const [interval, setRepeatInterval] = useState(repeat?.interval || 1)
	const [days, setDays] = useState(repeat?.days || [])
	const [until, setUntil] = useState(repeat?.until || '')
	const today = getLocalDateKey()
	const quick = [['today', today], ['tomorrow', addDaysToKey(today, 1)], ['nextWeek', addDaysToKey(today, 7)]]
	const hasDue = useDue && Boolean(due)
	const rule = hasDue && frequency ? {
		frequency,
		interval: frequency === 'weekdays' ? 1 : Math.min(Math.max(Number(interval) || 1, 1), 99),
		...(frequency === 'weekly' && { days: days.length ? [...days].sort() : [weekdayOfKey(due)] }),
		...((frequency === 'monthly' || frequency === 'yearly') && { dayOfMonth: Number(due.slice(8, 10)) }),
		until: until || null,
	} : null
	const nextKey = rule ? nextOccurrence(rule, due) : null
	const nextText = nextKey && (!rule.until || nextKey <= rule.until)
		? new Intl.DateTimeFormat(intlLocale(language), { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${nextKey}T00:00:00Z`))
		: ''
	const toggleDay = (day) => setDays((current) => {
		const base = current.length ? current : due ? [weekdayOfKey(due)] : []
		return base.includes(day) ? base.filter((item) => item !== day) : [...base, day]
	})
	const shownDays = days.length ? days : due ? [weekdayOfKey(due)] : []
	const save = (event) => {
		event.preventDefault()
		const { dayOfMonth: _dayOfMonth, ...sent } = rule || {}
		const nextRepeat = rule ? sent : null
		// The repeat rule goes along only when it changed, so a date change stays a date change.
		const shape = (value) => (value ? JSON.stringify([value.frequency, value.interval || 1, value.frequency === 'weekly' ? [...(value.days || [])].sort() : [], value.until || null]) : null)
		const repeatChanged = shape(nextRepeat) !== shape(repeat?.frequency ? repeat : null)
		onSave({ startDate: useStart && start ? start : null, dueDate: hasDue ? due : null, ...(repeatChanged && { repeat: nextRepeat }) })
	}
	return (
		<form className='cp-form' onSubmit={save}>
			<div className='cp-quick'>
				{quick.map(([key, value]) => (
					<button key={key} type='button' className={cx('ui-chip', useDue && due === value && 'is-on')} aria-pressed={useDue && due === value} onClick={() => { setUseDue(true); setDue(value) }}>{t(`card.${key}`)}</button>
				))}
			</div>
			<div className='cp-date-row'>
				<Checkbox checked={useStart} onChange={(event) => setUseStart(event.target.checked)} label={t('card.startDate')} />
				<input type='date' className='ui-control' value={start} disabled={!useStart} max={due || undefined} onChange={(event) => setStart(event.target.value)} aria-label={t('card.startDate')} />
			</div>
			<div className='cp-date-row'>
				<Checkbox checked={useDue} onChange={(event) => setUseDue(event.target.checked)} label={t('card.dueDate')} />
				<input type='date' className='ui-control' value={due} disabled={!useDue} min={start || undefined} onChange={(event) => setDue(event.target.value)} aria-label={t('card.dueDate')} />
			</div>
			<div className='cp-repeat'>
				<label className='cp-repeat__label' htmlFor='card-repeat'><Repeat size={15} aria-hidden='true' />{t('repeat.title')}</label>
				<Select
					id='card-repeat'
					value={hasDue ? frequency : ''}
					disabled={!hasDue}
					onChange={(event) => setFrequency(event.target.value)}
					options={[{ value: '', label: t('repeat.never') }, ...FREQUENCIES.map((value) => ({ value, label: t(`repeat.options.${value}`) }))]}
				/>
				{!hasDue && <p className='cp-hint'>{t('repeat.needsDue')}</p>}
				{rule && frequency !== 'weekdays' && (
					<div className='cp-repeat__every'>
						<span>{t('repeat.every')}</span>
						<input type='number' className='ui-control' min={1} max={99} value={interval} onChange={(event) => setRepeatInterval(event.target.value)} aria-label={t('repeat.interval')} />
						<span>{t(`repeat.units.${frequency}`, { count: rule.interval })}</span>
					</div>
				)}
				{rule && frequency === 'weekly' && (
					<div className='cp-repeat__days' role='group' aria-label={t('repeat.onDays')}>
						{weekdayChoices(language).map(({ day, label }) => (
							<button key={day} type='button' className={cx('cp-repeat__day', shownDays.includes(day) && 'is-on')} aria-pressed={shownDays.includes(day)} onClick={() => toggleDay(day)} disabled={shownDays.length === 1 && shownDays.includes(day)}>{label}</button>
						))}
					</div>
				)}
				{rule && (
					<div className='cp-date-row'>
						<Checkbox checked={Boolean(until)} onChange={(event) => setUntil(event.target.checked ? addDaysToKey(due, 30) : '')} label={t('repeat.untilLabel')} />
						<input type='date' className='ui-control' value={until} disabled={!until} min={due} onChange={(event) => setUntil(event.target.value)} aria-label={t('repeat.untilLabel')} />
					</div>
				)}
				{rule && (
					<p className='cp-repeat__summary'>
						{describeRepeat(t, rule, language)}
						{nextText && <> · {t('repeat.next', { date: nextText })}</>}
					</p>
				)}
			</div>
			<div className='cp-form__actions'>
				<Button type='submit'>{t('card.save')}</Button>
				{(startDate || dueDate) && <Button variant='ghost' onClick={onRemove}>{t('card.removeDates')}</Button>}
			</div>
		</form>
	)
}

/** Who is on the card: tick people on the board; you can join or leave in one tap. */
export const MembersPicker = ({ people, selected, onToggle }) => {
	const { t } = useI18n()
	const [query, setQuery] = useState('')
	const needle = query.trim().toLowerCase()
	const match = (person) => !needle || [person.name, person.email].some((value) => value?.toLowerCase().includes(needle))
	const onCard = people.filter((person) => selected.includes(String(person._id)) && match(person))
	const others = people.filter((person) => !selected.includes(String(person._id)) && match(person))
	const row = (person, on) => (
		<li key={person._id}>
			<button type='button' className={cx('cp-person', on && 'is-on')} aria-pressed={on} onClick={() => onToggle(String(person._id))}>
				<Avatar name={person.name} src={person.avatar} size={30} status={person.status} />
				<span className='cp-person__text' data-i18n-ignore>
					<span>{person.name}{person.isMe && <span className='cp-hint'> · {t('boardHeader.you')}</span>}</span>
					<span className='cp-hint'>{person.email}</span>
				</span>
				{on && <Check size={16} className='cp-person__check' aria-hidden='true' />}
			</button>
		</li>
	)
	return (
		<div className='cp-stack'>
			<Input icon={Search} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('card.searchMembers')} aria-label={t('card.searchMembers')} />
			{onCard.length > 0 && <><h4 className='cp-section'>{t('card.cardMembers')}</h4><ul className='cp-list'>{onCard.map((person) => row(person, true))}</ul></>}
			{others.length > 0 && <><h4 className='cp-section'>{t('card.boardMembers')}</h4><ul className='cp-list'>{others.map((person) => row(person, false))}</ul></>}
			{!onCard.length && !others.length && <p className='cp-hint'>{t('card.noMembersFound')}</p>}
		</div>
	)
}

/** A link (any http/https address) or, when the server allows, an image file. */
export const AttachmentPicker = ({ uploads, onLink, onImage }) => {
	const { t } = useI18n()
	const [url, setUrl] = useState('')
	const [name, setName] = useState('')
	const [error, setError] = useState('')
	const [busy, setBusy] = useState(false)
	const fileRef = useRef(null)
	const submit = async (event) => {
		event.preventDefault()
		if (!/^https?:\/\/\S+\.\S+/i.test(url.trim())) {
			setError(t('card.linkInvalid'))
			return
		}
		setBusy(true)
		const ok = await onLink(url.trim(), name.trim())
		setBusy(false)
		if (ok) {
			setUrl('')
			setName('')
		}
	}
	const pickFile = async (event) => {
		const file = event.target.files?.[0]
		event.target.value = ''
		if (!file) return
		if (file.size > 5 * 1024 * 1024) {
			setError(t('card.imageTooBig'))
			return
		}
		const reader = new FileReader()
		reader.onload = async () => {
			setBusy(true)
			await onImage(reader.result, file.name)
			setBusy(false)
		}
		reader.readAsDataURL(file)
	}
	return (
		<form className='cp-form' onSubmit={submit} noValidate>
			<Field label={t('card.linkUrl')} error={error}>
				<Input icon={Link2} type='url' inputMode='url' value={url} onChange={(event) => { setUrl(event.target.value); setError('') }} placeholder='https://' />
			</Field>
			<Field label={t('card.linkName')}>
				<Input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} />
			</Field>
			<Button type='submit' loading={busy} disabled={!url.trim()}>{t('card.insert')}</Button>
			<div className='cp-divider' />
			{uploads ? (
				<>
					<input ref={fileRef} type='file' accept='image/png,image/jpeg,image/webp,image/gif' hidden onChange={pickFile} />
					<Button variant='secondary' icon={ImagePlus} block loading={busy} onClick={() => fileRef.current?.click()}>{t('card.upload')}</Button>
				</>
			) : (
				<p className='cp-hint'>{t('card.uploadsOff')}</p>
			)}
		</form>
	)
}

/**
 * Cover: a colour or a photo, as a band above the title or filling the card. The photo
 * can be your own (resized in the browser, kept with the card's attachments), one
 * already attached, or one from the photo library when the server offers it.
 */
export const CoverPicker = ({ cover, images, onChange, onUpload }) => {
	const { t } = useI18n()
	const photosOnline = useServerConfig((state) => state.photos)
	const [query, setQuery] = useState('')
	const search = usePhotoSearch(query, photosOnline)
	const fileRef = useRef(null)
	const [isUploading, setIsUploading] = useState(false)
	const [isOver, setIsOver] = useState(false)
	const size = cover?.size || 'strip'
	const choose = (next) => onChange({ ...next, size })
	const upload = async (file) => {
		if (!file || isUploading) return
		setIsUploading(true)
		try {
			const { image } = await prepareBackgroundImage(file)
			await onUpload(image, file.name, size)
		} catch (error) {
			if (error.code) toast.error(t(`backgrounds.own.errors.${error.code}`))
			else toast.error(translateServerMessageCurrent(error.response?.data?.message, 'card.coverUploadError'))
		} finally {
			setIsUploading(false)
		}
	}
	return (
		<div className='cp-stack'>
			{onUpload && (
				<>
					<button
						type='button'
						className={cx('cp-cover-upload', isOver && 'is-over')}
						disabled={isUploading}
						onClick={() => fileRef.current?.click()}
						onDragOver={(event) => {
							event.preventDefault()
							setIsOver(true)
						}}
						onDragLeave={() => setIsOver(false)}
						onDrop={(event) => {
							event.preventDefault()
							setIsOver(false)
							upload(event.dataTransfer.files?.[0])
						}}
					>
						<span className='cp-cover-upload__icon' aria-hidden='true'>{isUploading ? <Loader2 size={18} className='bg-spin' /> : <ImagePlus size={18} />}</span>
						<span className='cp-cover-upload__text'>
							<span className='cp-cover-upload__title'>{isUploading ? t('backgrounds.own.uploading') : t('card.coverUpload')}</span>
							<span className='cp-hint'>{t('card.coverUploadHint')}</span>
						</span>
					</button>
					<input ref={fileRef} type='file' accept='image/jpeg,image/png,image/webp,image/gif' hidden onChange={(event) => { upload(event.target.files?.[0]); event.target.value = '' }} />
				</>
			)}
			{cover && (
				<>
					<h4 className='cp-section'>{t('card.size')}</h4>
					<div className='cp-sizes'>
						{['strip', 'full'].map((value) => (
							<button key={value} type='button' className={cx('cp-size', `cp-size--${value}`, size === value && 'is-selected')} aria-pressed={size === value} onClick={() => onChange({ ...cover, size: value })}>
								<span className='cp-size__art' aria-hidden='true' />
								<span>{t(`card.${value}`)}</span>
							</button>
						))}
					</div>
				</>
			)}
			<h4 className='cp-section'>{t('card.colors')}</h4>
			<ColorSwatches value={cover?.type === 'color' ? cover.key : null} onChange={(key) => choose({ type: 'color', key })} label={t('card.colors')} />
			{images.length > 0 && (
				<>
					<h4 className='cp-section'>{t('card.fromAttachments')}</h4>
					<div className='cp-photos'>
						{images.map((image) => (
							<button key={image._id} type='button' className={cx('cp-photo', cover?.url === image.url && 'is-selected')} style={{ backgroundImage: `url("${assetUrl(image.url)}")` }} aria-label={image.name || t('card.makeCover')} onClick={() => choose({ type: 'photo', id: `attachment-${image._id}`, url: image.url, thumb: image.url })} />
						))}
					</div>
				</>
			)}
			{photosOnline && (
				<>
					<h4 className='cp-section'>{t('card.photos')}</h4>
					<Input icon={Search} type='search' value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('card.searchPhotos')} aria-label={t('card.searchPhotos')} />
					<div className='cp-photos'>
						{search.photos.slice(0, 12).map((photo) => (
							<BackgroundSwatch key={photo.id} background={{ type: 'photo', ...photo }} selected={cover?.id === photo.id} label={photo.author || t('card.photos')} onSelect={(value) => choose({ ...value, type: 'photo' })} />
						))}
					</div>
				</>
			)}
			{cover && <Button variant='secondary' block onClick={() => onChange(null)}>{t('card.removeCover')}</Button>}
		</div>
	)
}

/** Copy a card: its title, what to keep, and which list. */
export const CopyCardPicker = ({ task, columns, onCopy }) => {
	const { t } = useI18n()
	const [title, setTitle] = useState(t('card.copySuffix', { title: task.title }))
	const [column, setColumn] = useState(String(task.column))
	const [keep, setKeep] = useState({ checklist: true, labels: true, members: true, attachments: true, dates: true })
	const [busy, setBusy] = useState(false)
	const submit = async (event) => {
		event.preventDefault()
		if (!title.trim()) return
		setBusy(true)
		await onCopy({ title: title.trim(), column, keep })
		setBusy(false)
	}
	return (
		<form className='cp-form' onSubmit={submit}>
			<Field label={t('card.copyName')}>
				<Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} />
			</Field>
			<h4 className='cp-section'>{t('card.keep')}</h4>
			<div className='cp-checks'>
				{['checklist', 'labels', 'members', 'attachments', 'dates'].map((key) => (
					<Checkbox key={key} checked={keep[key]} onChange={(event) => setKeep({ ...keep, [key]: event.target.checked })} label={t(`card.keep${key[0].toUpperCase()}${key.slice(1)}`)} />
				))}
			</div>
			<Field label={t('card.copyTo')}>
				<Select value={column} onChange={(event) => setColumn(event.target.value)} options={columns.map((item) => ({ value: item._id, label: item.title }))} />
			</Field>
			<Button type='submit' loading={busy} disabled={!title.trim()}>{t('card.copyAction')}</Button>
		</form>
	)
}

/** Move a card to any list and position on the board. */
export const MoveCardPicker = ({ task, columns, onMove }) => {
	const { t } = useI18n()
	const [column, setColumn] = useState(String(task.column))
	const target = columns.find((item) => item._id === column)
	const sameList = column === String(task.column)
	const count = (target?.tasks.length || 0) - (sameList ? 1 : 0)
	const currentIndex = sameList ? Math.max(0, target.tasks.findIndex((item) => item._id === task._id)) : count
	const [position, setPosition] = useState(currentIndex)
	return (
		<form className='cp-form' onSubmit={(event) => { event.preventDefault(); onMove(column, Number(position)) }}>
			<Field label={t('card.copyTo')}>
				<Select value={column} onChange={(event) => { setColumn(event.target.value); const next = columns.find((item) => item._id === event.target.value); setPosition(event.target.value === String(task.column) ? currentIndex : next?.tasks.length || 0) }} options={columns.map((item) => ({ value: item._id, label: item.title }))} />
			</Field>
			<Field label={t('card.position')}>
				<Select value={String(position)} onChange={(event) => setPosition(Number(event.target.value))} options={Array.from({ length: count + 1 }, (_, index) => ({ value: String(index), label: String(index + 1) }))} />
			</Field>
			<Button type='submit'>{t('card.moveAction')}</Button>
		</form>
	)
}
