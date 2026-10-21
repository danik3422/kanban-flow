import { Mail, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { useI18n } from '../../../i18n'
import { Avatar } from '../../../ui'
import { cx } from '../../../ui/utils'

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SPLIT = /[\s,;]+/

/**
 * Several emails in one field: Enter, comma or space turns what was typed into a
 * chip; a pasted list splits on its own; Backspace on an empty field removes the
 * last chip. People you already work with are suggested as you type.
 */
const EmailChips = ({ emails, onChange, suggestions = [], excluded = [], disabled, invalid }) => {
	const { t } = useI18n()
	const [draft, setDraft] = useState('')
	const [active, setActive] = useState(0)
	const inputRef = useRef(null)

	const add = (values) => {
		const next = [...emails]
		for (const raw of values) {
			const email = raw.trim().toLowerCase()
			if (email && !next.includes(email)) next.push(email)
		}
		onChange(next)
	}
	const commit = () => {
		if (!draft.trim()) return
		add(draft.split(SPLIT))
		setDraft('')
	}
	const needle = draft.trim().toLowerCase()
	const matches = needle
		? suggestions.filter((person) => !emails.includes(person.email) && !excluded.includes(person.email)
			&& [person.name, person.email].some((value) => value?.toLowerCase().includes(needle))).slice(0, 5)
		: []

	const pick = (person) => {
		add([person.email])
		setDraft('')
		inputRef.current?.focus()
	}

	return (
		<div className='bh-chips-field-wrap'>
			<div className={cx('bh-chips-field', invalid && 'is-invalid', disabled && 'is-disabled')} onClick={() => inputRef.current?.focus()}>
				<Mail size={16} className='bh-chips-field__icon' aria-hidden='true' />
				{emails.map((email) => (
					<span key={email} className={cx('bh-email-chip', !EMAIL.test(email) && 'is-invalid')} data-i18n-ignore>
						{email}
						<button type='button' className='bh-email-chip__remove' aria-label={t('boardHeader.removeEmail', { email })} onClick={(event) => { event.stopPropagation(); onChange(emails.filter((item) => item !== email)) }}>
							<X size={13} aria-hidden='true' />
						</button>
					</span>
				))}
				<input
					ref={inputRef}
					className='bh-chips-field__input'
					type='email'
					inputMode='email'
					autoComplete='off'
					value={draft}
					disabled={disabled}
					placeholder={emails.length ? '' : t('boardHeader.emailsPlaceholder')}
					aria-label={t('boardHeader.emailsLabel')}
					aria-invalid={invalid ? 'true' : undefined}
					role='combobox'
					aria-expanded={matches.length > 0}
					aria-controls='bh-suggestions'
					aria-activedescendant={matches.length ? `bh-suggestion-${active}` : undefined}
					onChange={(event) => {
						const value = event.target.value
						if (SPLIT.test(value) && value.replace(SPLIT, '').length) {
							add(value.split(SPLIT).slice(0, -1))
							setDraft(value.split(SPLIT).pop())
						} else setDraft(value)
						setActive(0)
					}}
					onPaste={(event) => {
						const text = event.clipboardData.getData('text')
						if (SPLIT.test(text.trim())) {
							event.preventDefault()
							add(text.split(SPLIT))
						}
					}}
					onKeyDown={(event) => {
						if (matches.length && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
							event.preventDefault()
							setActive((current) => (current + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length)
						} else if (event.key === 'Enter' && matches.length) {
							event.preventDefault()
							pick(matches[active] || matches[0])
						} else if (event.key === 'Enter' || event.key === ',' || event.key === 'Tab') {
							if (draft.trim()) {
								event.preventDefault()
								commit()
							}
						} else if (event.key === 'Backspace' && !draft && emails.length) {
							onChange(emails.slice(0, -1))
						}
					}}
					onBlur={() => window.setTimeout(commit, 120)}
				/>
			</div>
			{matches.length > 0 && (
				<ul className='bh-suggestions' id='bh-suggestions' role='listbox' aria-label={t('boardHeader.suggestions')}>
					{matches.map((person, index) => (
						<li key={person.email} id={`bh-suggestion-${index}`} role='option' aria-selected={index === active}>
							<button type='button' className={cx('bh-suggestion', index === active && 'is-active')} onMouseDown={(event) => event.preventDefault()} onClick={() => pick(person)}>
								<Avatar name={person.name || person.email} src={person.avatar} size={28} />
								<span className='bh-suggestion__text' data-i18n-ignore>
									<span className='bh-suggestion__name'>{person.name || person.email}</span>
									<span className='bh-muted'>{person.email}</span>
								</span>
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	)
}

export default EmailChips
