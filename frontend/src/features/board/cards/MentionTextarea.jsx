import { useId, useRef, useState } from 'react'
import { useI18n } from '../../../i18n'
import { Avatar, Textarea } from '../../../ui'
import { cx } from '../../../ui/utils'
import { matchPeople, mentionAt } from '../model/mentions'

/**
 * A comment box that suggests people after "@": arrows pick, Enter or Tab inserts
 * "@Name ", Escape closes the list (and not the card).
 */
const MentionTextarea = ({ value, onChange, people, onKeyDown, ...props }) => {
	const { t } = useI18n()
	const listId = useId()
	const ref = useRef(null)
	const [mention, setMention] = useState(null) // { start, query }
	const [active, setActive] = useState(0)
	const matches = mention ? matchPeople(people, mention.query) : []
	const open = matches.length > 0

	const track = (text, caret) => {
		const next = mentionAt(text, caret)
		setMention(next)
		if (next?.query !== mention?.query) setActive(0)
	}

	const insert = (person) => {
		const textarea = ref.current
		const caret = textarea?.selectionStart ?? value.length
		const before = value.slice(0, mention.start)
		const after = value.slice(caret).replace(/^\S*/, '')
		const inserted = `@${person.name} `
		onChange(`${before}${inserted}${after.replace(/^\s/, '')}`)
		setMention(null)
		window.requestAnimationFrame(() => {
			const position = before.length + inserted.length
			textarea?.focus()
			textarea?.setSelectionRange(position, position)
		})
	}

	return (
		<div className='mention-box'>
			<Textarea
				ref={ref}
				value={value}
				role='combobox'
				aria-expanded={open}
				aria-controls={open ? listId : undefined}
				aria-activedescendant={open ? `${listId}-${active}` : undefined}
				aria-autocomplete='list'
				onChange={(event) => {
					onChange(event.target.value)
					track(event.target.value, event.target.selectionStart)
				}}
				onSelect={(event) => track(event.target.value, event.target.selectionStart)}
				onBlur={() => window.setTimeout(() => setMention(null), 120)}
				onKeyDown={(event) => {
					if (open) {
						if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
							event.preventDefault()
							const step = event.key === 'ArrowDown' ? 1 : -1
							setActive((index) => (index + step + matches.length) % matches.length)
							return
						}
						if ((event.key === 'Enter' && !event.metaKey && !event.ctrlKey) || event.key === 'Tab') {
							event.preventDefault()
							insert(matches[active])
							return
						}
						if (event.key === 'Escape') {
							event.preventDefault()
							event.stopPropagation()
							setMention(null)
							return
						}
					}
					onKeyDown?.(event)
				}}
				{...props}
			/>
			{open && (
				<ul className='mention-list' id={listId} role='listbox' aria-label={t('card.mentionPeople')}>
					{matches.map((person, index) => (
						<li
							key={person._id}
							id={`${listId}-${index}`}
							role='option'
							aria-selected={index === active}
							className={cx('mention-list__item', index === active && 'is-active')}
							onMouseDown={(event) => {
								event.preventDefault()
								insert(person)
							}}
							onMouseEnter={() => setActive(index)}
						>
							<Avatar name={person.name} src={person.avatar} size={24} decorative />
							<span className='mention-list__text' data-i18n-ignore>
								<span className='mention-list__name'>{person.name}</span>
								{person.email && <span className='mention-list__email'>{person.email}</span>}
							</span>
						</li>
					))}
				</ul>
			)}
		</div>
	)
}

export default MentionTextarea
