import { Check, ChevronDown, Globe2, LocateFixed, Search, SearchX } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { getDetectedTimezone, popularTimezoneIds, searchTimezones, timezoneEntries } from '../../data/timezones'
import { useI18n } from '../../i18n'
import { intlLocale } from '../../i18n/translate'
import { EmptyState, Input, Modal } from '../../ui'
import { cx } from '../../ui/utils'
import './timezone-picker.css'

const timeIn = (timeZone, locale) => {
	try {
		return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', timeZone }).format(new Date())
	} catch {
		return ''
	}
}

const Option = ({ entry, index, isActive, isSelected, locale, onPick, onHover }) => (
	<button
		type='button'
		role='option'
		id={`tzp-option-${index}`}
		data-index={index}
		aria-selected={isSelected}
		tabIndex={-1}
		className={cx('tzp-option', isActive && 'is-active', isSelected && 'is-selected')}
		onClick={() => onPick(entry.value)}
		onMouseMove={() => onHover(index)}
	>
		<span className='tzp-option__text'>
			<span className='tzp-option__city' data-i18n-ignore>{entry.city}</span>
			<span className='tzp-option__area' data-i18n-ignore>{entry.area || entry.value}</span>
		</span>
		<span className='tzp-option__meta'>
			<span className='tzp-option__time'>{timeIn(entry.value, locale)}</span>
			<span className='tzp-option__offset'>{entry.offset}</span>
		</span>
		<Check className='tzp-option__check' size={16} aria-hidden='true' />
	</button>
)

/**
 * A timezone field you can search: by city (also in Ukrainian and Russian), area
 * ("Eastern European Time"), offset ("+3", "UTC+2") or code. Offers this device's zone.
 */
const TimezonePicker = ({ id, value, onChange, 'aria-describedby': describedBy, 'aria-invalid': invalid }) => {
	const { t, language } = useI18n()
	const locale = intlLocale(language)
	const [open, setOpen] = useState(false)
	const [query, setQuery] = useState('')
	const [activeIndex, setActiveIndex] = useState(0)
	const searchRef = useRef(null)
	const listRef = useRef(null)
	const entries = timezoneEntries(locale)
	const current = entries.find((entry) => entry.value === value)
	const detected = getDetectedTimezone()
	const detectedEntry = detected !== 'UTC' || Intl.DateTimeFormat().resolvedOptions().timeZone === 'UTC' ? entries.find((entry) => entry.value === detected) : null

	// No search: this device, then popular places, then everything by offset.
	const groups = useMemo(() => {
		if (query.trim()) return [{ key: 'results', items: searchTimezones(query, locale) }]
		const popular = popularTimezoneIds.map((zone) => entries.find((entry) => entry.value === zone)).filter(Boolean)
		const all = [...entries].sort((a, b) => a.offsetMinutes - b.offsetMinutes || a.city.localeCompare(b.city))
		return [
			detectedEntry && { key: 'device', items: [detectedEntry] },
			{ key: 'popular', items: popular },
			{ key: 'all', items: all },
		].filter(Boolean)
	}, [query, locale, entries, detectedEntry])
	const flat = groups.flatMap((group) => group.items)

	const show = () => {
		setQuery('')
		const selected = flat.findIndex((entry) => entry.value === value)
		setActiveIndex(Math.max(0, selected))
		setOpen(true)
		window.requestAnimationFrame(() => listRef.current?.querySelector(`[data-index="${Math.max(0, selected)}"]`)?.scrollIntoView({ block: 'center' }))
	}
	const pick = (zone) => {
		onChange(zone)
		setOpen(false)
	}
	const move = (next) => {
		setActiveIndex(next)
		listRef.current?.querySelector(`[data-index="${next}"]`)?.scrollIntoView({ block: 'nearest' })
	}
	const onKeyDown = (event) => {
		if (!flat.length) return
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault()
			move((activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + flat.length) % flat.length)
		} else if (event.key === 'Home' || event.key === 'End') {
			if (!event.shiftKey && query) return
			event.preventDefault()
			move(event.key === 'Home' ? 0 : flat.length - 1)
		} else if (event.key === 'Enter') {
			event.preventDefault()
			pick(flat[activeIndex]?.value)
		}
	}

	let index = -1
	return (
		<>
			<button
				type='button'
				id={id}
				className='ui-control tzp-trigger'
				onClick={show}
				aria-haspopup='dialog'
				aria-describedby={describedBy}
				aria-invalid={invalid}
			>
				<Globe2 size={16} aria-hidden='true' className='tzp-trigger__icon' />
				<span className='tzp-trigger__city' data-i18n-ignore>{current?.city || value}</span>
				{current && <span className='tzp-trigger__offset'>{current.offset}</span>}
				<ChevronDown size={16} aria-hidden='true' className='tzp-trigger__chevron' />
			</button>
			{detectedEntry && detectedEntry.value !== value && (
				<button type='button' className='tzp-detect' onClick={() => onChange(detectedEntry.value)}>
					<LocateFixed size={14} aria-hidden='true' />
					<span>{t('timezone.useDevice', { zone: detectedEntry.value })}</span>
				</button>
			)}
			<Modal open={open} onClose={() => setOpen(false)} title={t('timezone.title')} size='sm' className='tzp-modal' initialFocusRef={searchRef}>
				<Input
					ref={searchRef}
					icon={Search}
					type='search'
					value={query}
					onChange={(event) => {
						setQuery(event.target.value)
						setActiveIndex(0)
						listRef.current?.scrollTo({ top: 0 })
					}}
					onKeyDown={onKeyDown}
					placeholder={t('timezone.search')}
					aria-label={t('timezone.search')}
					role='combobox'
					aria-expanded='true'
					aria-controls='tzp-list'
					aria-activedescendant={flat.length ? `tzp-option-${activeIndex}` : undefined}
					autoComplete='off'
					className='tzp-search'
				/>
				{flat.length ? (
					<div className='tzp-list' id='tzp-list' role='listbox' ref={listRef} aria-label={t('timezone.title')}>
						{groups.map((group) => (
							<div key={group.key} role='group' aria-labelledby={`tzp-group-${group.key}`}>
								<p className='tzp-group' id={`tzp-group-${group.key}`}>{t(`timezone.groups.${group.key}`)}</p>
								{group.items.map((entry) => {
									index += 1
									return (
										<Option key={`${group.key}-${entry.value}`} entry={entry} index={index} locale={locale} isActive={index === activeIndex} isSelected={entry.value === value} onPick={pick} onHover={setActiveIndex} />
									)
								})}
							</div>
						))}
					</div>
				) : (
					<EmptyState icon={SearchX} title={t('timezone.empty', { query: query.trim() })} description={t('timezone.emptyText')} />
				)}
			</Modal>
		</>
	)
}

export default TimezonePicker
