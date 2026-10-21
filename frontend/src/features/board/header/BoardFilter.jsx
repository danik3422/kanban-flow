import { Search, UserRound, UserX } from 'lucide-react'
import { useRef } from 'react'
import { useI18n } from '../../../i18n'
import { Avatar, Button, Checkbox, Chip, Input, Modal } from '../../../ui'
import { CARD_COLORS, labelColorKey } from '../model/cardDisplay'
import { DUE_OPTIONS, EMPTY_FILTER, NO_MEMBER, activeFilterCount, toggleIn } from '../model/cardFilter'

const PRIORITIES = ['urgent', 'high', 'medium', 'low', 'none']

/**
 * Trello's card filter: words, people, due dates, priority and labels. The board
 * filters as you choose; a side panel on wide screens, a bottom sheet on phones.
 */
const BoardFilter = ({ open, onClose, filter, onChange, people, labels, savedLabels = [], currentUserId, matchCount, totalCount }) => {
	const { t } = useI18n()
	const searchRef = useRef(null)
	const set = (key, value) => onChange({ ...filter, [key]: value })
	const toggle = (key, value) => set(key, toggleIn(filter[key], value))
	const others = people.filter((person) => String(person._id) !== String(currentUserId))
	const active = activeFilterCount(filter) > 0

	return (
		<Modal
			open={open}
			onClose={onClose}
			title={t('boardHeader.filterTitle')}
			variant='panel'
			className='bh-filter-modal'
			initialFocusRef={searchRef}
			footer={(
				<div className='bh-filter-footer'>
					<span className='bh-filter-footer__count' role='status'>{active ? t('boardHeader.matches', { count: matchCount }) : t('boardHeader.matches', { count: totalCount })}</span>
					<Button variant='secondary' size='sm' onClick={() => onChange(EMPTY_FILTER)} disabled={!active}>{t('boardHeader.clear')}</Button>
				</div>
			)}
		>
			<div className='bh-filter-body'>
				<section>
					<h3 className='bh-section-title'>{t('boardHeader.keyword')}</h3>
					<Input ref={searchRef} icon={Search} type='search' value={filter.text} onChange={(event) => set('text', event.target.value)} placeholder={t('boardHeader.keywordPlaceholder')} aria-label={t('boardHeader.keyword')} />
				</section>

				<section>
					<h3 className='bh-section-title'>{t('boardHeader.members')}</h3>
					<div className='bh-check-list'>
						<Checkbox checked={filter.members.includes(NO_MEMBER)} onChange={() => toggle('members', NO_MEMBER)} label={<span className='bh-check-person'><span className='bh-check-person__icon'><UserX size={15} aria-hidden='true' /></span>{t('boardHeader.noMembers')}</span>} />
						{currentUserId && (
							<Checkbox checked={filter.members.includes(String(currentUserId))} onChange={() => toggle('members', String(currentUserId))} label={<span className='bh-check-person'><span className='bh-check-person__icon'><UserRound size={15} aria-hidden='true' /></span>{t('boardHeader.mine')}</span>} />
						)}
						{others.map((person) => (
							<Checkbox key={person._id} checked={filter.members.includes(String(person._id))} onChange={() => toggle('members', String(person._id))} label={<span className='bh-check-person'><Avatar name={person.name || person.email} src={person.avatar} size={22} /><span data-i18n-ignore>{person.name || person.email}</span></span>} />
						))}
					</div>
				</section>

				<section>
					<h3 className='bh-section-title'>{t('boardHeader.due')}</h3>
					<div className='bh-check-list'>
						{DUE_OPTIONS.map((option) => (
							<Checkbox key={option} checked={filter.due.includes(option)} onChange={() => toggle('due', option)} label={t(`boardHeader.dueOptions.${option}`)} />
						))}
					</div>
				</section>

				<section>
					<h3 className='bh-section-title'>{t('boardHeader.priority')}</h3>
					<div className='bh-chips'>
						{PRIORITIES.map((priority) => (
							<Chip key={priority} pressed={filter.priority.includes(priority)} onClick={() => toggle('priority', priority)} className={`bh-priority bh-priority--${priority}`}>
								{t(`myTasks.priority.${priority}`)}
							</Chip>
						))}
					</div>
				</section>

				<section>
					<h3 className='bh-section-title'>{t('boardHeader.labels')}</h3>
					{labels.length ? (
						<div className='bh-chips'>
							{labels.map((label) => (
								<Chip key={label} pressed={filter.labels.includes(label)} onClick={() => toggle('labels', label)} className='bh-label-chip' style={{ '--label': CARD_COLORS[labelColorKey(label, savedLabels)] }}><span data-i18n-ignore>{label}</span></Chip>
							))}
						</div>
					) : (
						<p className='bh-muted'>{t('boardHeader.noLabels')}</p>
					)}
				</section>

				<p className='bh-muted bh-filter__shortcuts'>{t('boardHeader.shortcuts')}</p>
			</div>
		</Modal>
	)
}

export default BoardFilter
