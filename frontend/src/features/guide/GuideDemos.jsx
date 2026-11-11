import { ArrowLeft, ArrowRight, Check, CircleCheck, Clock3, Keyboard, Repeat, RotateCcw, Tag, Undo2, Zap } from 'lucide-react'
import { useId, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../i18n'
import { intlLocale } from '../../i18n/translate'
import { getLocalDateKey } from '../../lib/dueDate'
import { shortcutKey } from '../../lib/shortcutKey'
import { Button, Chip, SegmentedControl, Select, Switch } from '../../ui'
import { cx } from '../../ui/utils'
import { describeRule } from '../board/automation/ruleModel'
import { SHORTCUT_GROUPS } from '../board/header/shortcutGroups'
import { describeRepeat, nextOccurrence, weekdayChoices } from '../board/model/recurrence'
import DemoBoard from '../site/DemoBoard'
import { GUIDE_ICONS } from './guideIcons'
import { parseRich, PLAY_CARDS, PLAY_LISTS, playRules, runPlayRules } from './guideModel'

/** A guide text with its `code`, [[keys]] and **bold** in place. */
export const Rich = ({ text, as: Tag = 'span', className }) => (
	<Tag className={className}>
		{parseRich(text).map((part, index) => {
			if (part.type === 'code') return <code key={index} className='doc-inline'>{part.value}</code>
			if (part.type === 'key') return <kbd key={index} className='gd-kbd'>{part.value}</kbd>
			if (part.type === 'bold') return <strong key={index}>{part.value}</strong>
			return part.value
		})}
	</Tag>
)

/** An icon named in the guide's content. */
export const GuideIcon = ({ name, size = 18 }) => {
	const Icon = GUIDE_ICONS[name] || GUIDE_ICONS.Circle
	return <Icon size={size} aria-hidden='true' />
}

/** Tabs over a few panels, with arrow keys between the tabs. */
const Tabs = ({ label, items, renderPanel, className }) => {
	const [current, setCurrent] = useState(items[0].id)
	const base = useId()
	const select = (index) => {
		const item = items[(index + items.length) % items.length]
		setCurrent(item.id)
		document.getElementById(`${base}-tab-${item.id}`)?.focus()
	}
	const index = items.findIndex((item) => item.id === current)
	return (
		<div className={cx('gd-tabs', className)}>
			<div className='gd-tabs__list' role='tablist' aria-label={label}>
				{items.map((item, at) => (
					<button
						key={item.id}
						id={`${base}-tab-${item.id}`}
						type='button'
						role='tab'
						aria-selected={item.id === current}
						aria-controls={`${base}-panel`}
						tabIndex={item.id === current ? 0 : -1}
						className='gd-tabs__tab'
						onClick={() => setCurrent(item.id)}
						onKeyDown={(event) => {
							if (event.key === 'ArrowRight') select(at + 1)
							if (event.key === 'ArrowLeft') select(at - 1)
						}}
					>
						{item.icon && <GuideIcon name={item.icon} size={16} />}
						<span>{item.title}</span>
					</button>
				))}
			</div>
			<div id={`${base}-panel`} role='tabpanel' aria-labelledby={`${base}-tab-${current}`} className='gd-tabs__panel'>
				{renderPanel(items[index])}
			</div>
		</div>
	)
}

/** The board views, each with a small picture of how it looks. */
export const ViewsDemo = ({ section, keysLabel }) => {
	return (
		<Tabs
			label={section.title}
			items={section.views}
			className='gd-views'
			renderPanel={(view) => (
				<div className='gd-view'>
					<div className={cx('gd-view__picture', `gd-view__picture--${view.id}`)} aria-hidden='true'>
						{Array.from({ length: view.id === 'table' || view.id === 'mine' ? 5 : view.id === 'calendar' ? 14 : view.id === 'planner' ? 7 : 3 }, (_, at) => (
							<span key={at} className='gd-view__cell'>
								{(view.id === 'board' || view.id === 'planner') && Array.from({ length: (at % 3) + 1 }, (_, card) => <i key={card} />)}
							</span>
						))}
					</div>
					<div className='gd-view__text'>
						<h4 className='gd-view__title'>{view.title}</h4>
						<Rich as='p' text={view.text} />
						{view.keys && (
							<p className='gd-view__keys'>
								<span>{keysLabel}</span>
								{view.keys.map((key) => <kbd key={key} className='gd-kbd'>{key}</kbd>)}
							</p>
						)}
					</div>
				</div>
			)}
		/>
	)
}

// A weekly rule keeps at least one day: the last chip can't be switched off.
const toggleDay = (days, day) => {
	if (!days.includes(day)) return [...days, day]
	return days.length > 1 ? days.filter((value) => value !== day) : days
}

/** Pick a repeat rule and see the next dates of the series, as the app works them out. */
export const RepeatDemo = ({ copy }) => {
	const { t, language } = useI18n()
	const today = getLocalDateKey()
	const todayWeekday = new Date(`${today}T00:00:00Z`).getUTCDay() || 7
	const [frequency, setFrequency] = useState('weekly')
	const [every, setEvery] = useState(1)
	const [days, setDays] = useState([todayWeekday])
	const [dayOfMonth, setDayOfMonth] = useState(31)
	const repeat = { frequency, interval: frequency === 'weekdays' ? 1 : every, ...(frequency === 'weekly' && { days }), ...(frequency === 'monthly' && { dayOfMonth }) }
	const first = frequency === 'monthly' ? `${today.slice(0, 8)}${String(Math.min(dayOfMonth, new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0)).getUTCDate())).padStart(2, '0')}` : today
	// A handful of dates: cheap enough to work out on every render.
	const dates = []
	for (let key = first < today ? nextOccurrence(repeat, first) : first, guard = 0; key && dates.length < 6 && guard < 50; guard++) {
		dates.push(key)
		key = nextOccurrence(repeat, key)
	}
	// "Sat, 31 October", with the year once it is not this year's; first letter up only.
	const format = (key) => {
		const text = new Intl.DateTimeFormat(intlLocale(language), { weekday: 'short', day: 'numeric', month: 'long', ...(key.slice(0, 4) !== today.slice(0, 4) && { year: 'numeric' }), timeZone: 'UTC' }).format(new Date(`${key}T00:00:00Z`))
		return text.charAt(0).toLocaleUpperCase(intlLocale(language)) + text.slice(1)
	}
	// A unit is one word, or plural forms when the language needs them ("1 week", "2 weeks").
	const forms = copy.units[frequency === 'weekly' ? 'weekly' : frequency === 'monthly' ? 'monthly' : 'daily']
	const unit = typeof forms === 'string' ? forms : forms[new Intl.PluralRules(language).select(every)] ?? forms.other
	return (
		<div className='gd-repeat'>
			<div className='gd-repeat__controls'>
				<SegmentedControl label={copy.rule} value={frequency} onChange={setFrequency} options={['daily', 'weekdays', 'weekly', 'monthly'].map((value) => ({ value, label: copy.options[value] }))} className='gd-repeat__kind' />
				<div className='gd-repeat__row'>
					{frequency !== 'weekdays' && (
						<label className='gd-repeat__field'>
							<span>{copy.every}</span>
							<Select value={String(every)} onChange={(event) => setEvery(Number(event.target.value))} options={[1, 2, 3, 4].map((value) => ({ value: String(value), label: String(value) }))} />
							<span>{unit}</span>
						</label>
					)}
					{frequency === 'monthly' && (
						<label className='gd-repeat__field'>
							<span>{copy.dayOfMonth}</span>
							<Select value={String(dayOfMonth)} onChange={(event) => setDayOfMonth(Number(event.target.value))} options={[1, 15, 28, 30, 31].map((value) => ({ value: String(value), label: String(value) }))} />
						</label>
					)}
				</div>
				{frequency === 'weekly' && (
					<div className='gd-repeat__days' role='group' aria-label={copy.days}>
						{weekdayChoices(language).map(({ day, label }) => (
							<Chip key={day} pressed={days.includes(day)} onClick={() => setDays((current) => toggleDay(current, day))}>{label}</Chip>
						))}
					</div>
				)}
			</div>
			<div className='gd-repeat__result' aria-live='polite'>
				<p className='gd-repeat__rule'><Repeat size={16} aria-hidden='true' />{describeRepeat(t, repeat, language)}</p>
				<p className='gd-demo__label'>{copy.next}</p>
				<ol className='gd-repeat__dates'>
					{dates.map((key, index) => (
						<li key={key} className={cx(index === 0 && 'is-first')}>
							<span className='gd-repeat__dot' aria-hidden='true' />
							{format(key)}
						</li>
					))}
				</ol>
			</div>
		</div>
	)
}

/** Switch rules on, move cards, and see what the rules do — all in the page, nothing saved. */
export const RulesDemo = ({ copy }) => {
	const { t } = useI18n()
	const rules = useMemo(() => playRules(copy.label), [copy.label])
	const [enabled, setEnabled] = useState(['finish', 'file'])
	const [cards, setCards] = useState(PLAY_CARDS)
	const [log, setLog] = useState([])
	const nextEntryId = useRef(0)
	const columns = PLAY_LISTS.map((id) => ({ _id: id, title: copy.lists[id] }))
	const sentence = (rule) => {
		const { when, then } = describeRule(t, rule, { columns })
		return `${when} → ${then.join(', ')}`
	}
	const act = (cardId, change, event, said) => {
		const changed = cards.map((card) => (card.id === cardId ? { ...card, ...change } : card))
		const result = runPlayRules(changed, rules.filter((rule) => enabled.includes(rule.id)), cardId, event)
		setCards(result.cards)
		const lines = [{ kind: 'you', text: said }, ...result.fired.map((id) => ({ kind: 'rule', text: sentence(rules.find((rule) => rule.id === id)) }))]
		if (!result.fired.length) lines.push({ kind: 'none', text: copy.nothing })
		setLog((current) => [{ id: ++nextEntryId.current, lines }, ...current].slice(0, 4))
	}
	const move = (card, step) => {
		const column = PLAY_LISTS[PLAY_LISTS.indexOf(card.column) + step]
		act(card.id, { column }, { type: 'moved', column }, copy.youMoved.replace('{card}', copy.cards[card.id]).replace('{list}', copy.lists[column]))
	}
	const toggle = (card) => (card.completed
		? act(card.id, { completed: false }, { type: 'reopened', column: card.column }, copy.youReopened.replace('{card}', copy.cards[card.id]))
		: act(card.id, { completed: true }, { type: 'completed', column: card.column }, copy.youCompleted.replace('{card}', copy.cards[card.id])))
	const reset = () => {
		setCards(PLAY_CARDS)
		setLog([])
	}
	return (
		<div className='gd-rules'>
			<fieldset className='gd-rules__list'>
				<legend className='gd-demo__label'>{copy.rules}</legend>
				{rules.map((rule) => (
					<Switch
						key={rule.id}
						className='gd-rules__rule'
						label={<span className='gd-rules__sentence'><Zap size={14} aria-hidden='true' />{sentence(rule)}</span>}
						checked={enabled.includes(rule.id)}
						onChange={(event) => setEnabled((current) => (event.target.checked ? [...current, rule.id] : current.filter((id) => id !== rule.id)))}
					/>
				))}
			</fieldset>
			<div className='gd-rules__board' role='group' aria-label={copy.board}>
				{PLAY_LISTS.map((list, listIndex) => (
					<section key={list} className='gd-rules__column' aria-label={copy.lists[list]}>
						<h4 className='gd-rules__column-title'>{copy.lists[list]}</h4>
						{cards.filter((card) => card.column === list).map((card) => (
							<article key={card.id} className={cx('gd-rules__card', card.completed && 'is-done')}>
								<div className='gd-rules__card-head'>
									<button type='button' className='gd-rules__check' aria-pressed={card.completed} aria-label={(card.completed ? copy.reopen : copy.complete).replace('{card}', copy.cards[card.id])} onClick={() => toggle(card)}>
										{card.completed ? <CircleCheck size={18} aria-hidden='true' /> : <span className='gd-rules__circle' aria-hidden='true' />}
									</button>
									<span className='gd-rules__title'>{copy.cards[card.id]}</span>
								</div>
								{(card.labels.length > 0 || card.assigned || card.due) && (
									<div className='gd-rules__chips'>
										{card.labels.map((label) => <span key={label} className='gd-rules__chip gd-rules__chip--label'><Tag size={12} aria-hidden='true' />{label}</span>)}
										{card.due && <span className='gd-rules__chip'><Clock3 size={12} aria-hidden='true' />{copy.dueSoon}</span>}
										{card.assigned && <span className='gd-rules__chip gd-rules__chip--me'>{copy.you}</span>}
									</div>
								)}
								<div className='gd-rules__moves'>
									<button type='button' disabled={listIndex === 0} aria-label={copy.left.replace('{card}', copy.cards[card.id])} onClick={() => move(card, -1)}><ArrowLeft size={14} aria-hidden='true' /></button>
									<button type='button' disabled={listIndex === PLAY_LISTS.length - 1} aria-label={copy.right.replace('{card}', copy.cards[card.id])} onClick={() => move(card, 1)}><ArrowRight size={14} aria-hidden='true' /></button>
								</div>
							</article>
						))}
					</section>
				))}
			</div>
			<div className='gd-rules__log'>
				<div className='gd-rules__log-head'>
					<p className='gd-demo__label'>{copy.log}</p>
					<Button variant='ghost' size='sm' icon={RotateCcw} onClick={reset}>{copy.reset}</Button>
				</div>
				<ol className='gd-rules__entries' aria-live='polite'>
					{!log.length && <li className='gd-rules__empty'>{copy.empty}</li>}
					{log.map((entry) => (
						<li key={entry.id} className='gd-rules__entry'>
							{entry.lines.map((line, index) => (
								<span key={index} className={cx('gd-rules__line', `is-${line.kind}`)}>
									{line.kind === 'rule' && <Zap size={13} aria-hidden='true' />}
									{line.kind === 'none' && <Undo2 size={13} aria-hidden='true' />}
									{line.text}
								</span>
							))}
						</li>
					))}
				</ol>
			</div>
		</div>
	)
}

// How long "G" waits for the second key, as on the board (features/board/dock/BoardDock.jsx).
const G_WAIT_MS = 1200

// What a key press means on a board: [group, action] as in the shortcuts dialog.
const actionFor = (event, key, pendingG) => {
	if ((event.metaKey || event.ctrlKey) && key === 'k') return ['board', 'search']
	// The board ignores letters pressed with Alt (they type characters on some layouts).
	if (event.altKey && !event.key.startsWith('Arrow')) return null
	if (pendingG && ['p', 'b', 't'].includes(key)) return ['views', { p: 'planner', b: 'board', t: 'table' }[key]]
	if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) return ['move', 'moveInList']
	if (event.altKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) return ['move', 'moveToList']
	if (event.key.startsWith('Arrow')) return ['move', 'select']
	if (event.key === 'Escape') return ['move', 'close']
	if (event.key === 'Enter') return ['card', 'open']
	return { e: ['card', 'open'], n: ['board', 'n'], f: ['board', 'filter'], q: ['board', 'mine'], '?': ['board', 'help'], m: ['card', 'me'], c: ['card', 'complete'], a: ['card', 'archive'], b: ['views', 'switchBoards'] }[key] || null
}

/** Press keys in a box and see what each one does on a board, in any keyboard layout. */
export const KeysDemo = ({ copy }) => {
	const { t } = useI18n()
	const [pressed, setPressed] = useState(null)
	// When "G" was pressed, while it still waits for P, B or T.
	const [gPressedAt, setGPressedAt] = useState(0)
	const hintId = useId()
	const onKeyDown = (event) => {
		if (['Shift', 'Alt', 'Control', 'Meta', 'CapsLock'].includes(event.key) || event.key === 'Tab') return
		event.preventDefault()
		const key = shortcutKey(event)
		if (key === 'g' && !event.metaKey && !event.ctrlKey && !event.altKey) {
			setGPressedAt(event.timeStamp)
			setPressed({ label: 'G', typed: event.key, latin: 'G', waiting: true })
			return
		}
		const pendingG = gPressedAt > 0 && event.timeStamp - gPressedAt < G_WAIT_MS
		const action = actionFor(event, key, pendingG)
		setGPressedAt(0)
		const label = event.key.startsWith('Arrow') ? { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' }[event.key] : event.key === 'Escape' ? 'Esc' : event.key === 'Enter' ? 'Enter' : key.toUpperCase()
		const prefix = [(event.metaKey || event.ctrlKey) && (event.metaKey ? '⌘' : 'Ctrl'), event.altKey && 'Alt', pendingG && 'G'].filter(Boolean)
		setPressed({ label: [...prefix, label].join(' + '), typed: event.key, latin: key.toUpperCase(), action })
	}
	const otherLayout = pressed && pressed.typed.length === 1 && /[^ -~]/.test(pressed.typed)
	const meaning = pressed && (pressed.waiting ? copy.waiting : pressed.action ? t(`shortcuts.actions.${pressed.action[1]}`) : copy.unknown)
	return (
		<div className='gd-keys'>
			{/* Always in the page, so the first key press is read out too. */}
			<span className='ui-visually-hidden' aria-live='polite'>{meaning || ''}</span>
			<span id={hintId} className='ui-visually-hidden'>{copy.prompt}</span>
			<div className='gd-keys__pad' tabIndex={0} role='group' aria-label={copy.area} aria-describedby={hintId} onKeyDown={onKeyDown} onBlur={() => setGPressedAt(0)}>
				{pressed ? (
					<>
						<span className='gd-keys__label'>{copy.pressed}</span>
						<span className='gd-keys__pressed'>{pressed.label.split(' + ').map((part) => <kbd key={part} className='gd-kbd gd-kbd--big'>{part}</kbd>)}</span>
						<span className='gd-keys__meaning'>{meaning}</span>
						{otherLayout && <span className='gd-keys__layout'>{copy.layout.replace('{typed}', pressed.typed).replace('{key}', pressed.latin)}</span>}
					</>
				) : (
					<span className='gd-keys__prompt'><Keyboard size={22} aria-hidden='true' />{copy.prompt}</span>
				)}
			</div>
			<p className='gd-keys__touch'>{copy.touch}</p>
			<div className='gd-keys__groups'>
				{SHORTCUT_GROUPS.map((group) => (
					<section key={group.key} className='gd-keys__group'>
						<h4 className='gd-demo__label'>{t(`shortcuts.groups.${group.key}`)}</h4>
						<dl>
							{group.rows.map(([action, keys]) => (
								<div key={action} className={cx('gd-keys__row', pressed?.action?.[1] === action && 'is-hit')}>
									<dt>{t(`shortcuts.actions.${action}`)}</dt>
									<dd>{keys.map((key) => <kbd key={key} className='gd-kbd'>{key}</kbd>)}</dd>
								</div>
							))}
						</dl>
					</section>
				))}
			</div>
		</div>
	)
}

/** Step-by-step for each calendar app. */
export const CalendarAppsDemo = ({ section, copy }) => (
	<Tabs
		label={copy.pick}
		items={section.apps}
		className='gd-apps'
		renderPanel={(app) => (
			<ol className='gd-apps__steps'>
				{app.steps.map((step, index) => (
					<li key={index}>
						<span className='gd-apps__number' aria-hidden='true'>{index + 1}</span>
						<Rich text={step} />
					</li>
				))}
			</ol>
		)}
	/>
)

/** The mini board from the home page: drag cards between lists. */
export const BoardDemo = ({ copy }) => (
	<div className='gd-board'>
		<p className='gd-board__hint'><Check size={14} aria-hidden='true' />{copy.hint}</p>
		<DemoBoard />
	</div>
)
