import { Check, ChevronDown, Filter, Globe2, Layers, LockKeyhole, MoreHorizontal, Star, UserPlus, UsersRound } from 'lucide-react'
import { useRef, useState } from 'react'
import { useI18n } from '../../../i18n'
import { AvatarGroup, Button, IconButton, Menu } from '../../../ui'
import { cx } from '../../../ui/utils'
import './board-header.css'

export const VISIBILITY_ICONS = { private: LockKeyhole, workspace: UsersRound, public: Globe2 }
export const VISIBILITIES = ['private', 'workspace', 'public']

/** The board's name, renamed in place: click, type, Enter (Escape puts it back). */
const BoardName = ({ name, canEdit, onRename }) => {
	const { t } = useI18n()
	const [draft, setDraft] = useState(null)
	const [saving, setSaving] = useState(false)
	const inputRef = useRef(null)
	const editing = draft !== null

	const start = () => {
		if (!canEdit) return
		setDraft(name)
	}
	const finish = async (save) => {
		if (!editing || saving) return
		const next = draft.trim()
		if (!save || !next || next === name) {
			setDraft(null)
			return
		}
		setSaving(true)
		const ok = await onRename(next)
		setSaving(false)
		if (ok) setDraft(null)
		else inputRef.current?.focus()
	}

	if (editing) {
		return (
			<input
				ref={inputRef}
				className='bh-name bh-name--input'
				value={draft}
				maxLength={100}
				size={Math.max(6, draft.length + 1)}
				aria-label={t('boardHeader.rename')}
				disabled={saving}
				// Opened by a click on the name, so the cursor belongs here.
				autoFocus
				onFocus={(event) => event.target.select()}
				onChange={(event) => setDraft(event.target.value)}
				onBlur={() => finish(true)}
				onKeyDown={(event) => {
					if (event.key === 'Enter') {
						event.preventDefault()
						finish(true)
					} else if (event.key === 'Escape') {
						event.preventDefault()
						finish(false)
					}
				}}
				data-i18n-ignore
			/>
		)
	}
	return canEdit ? (
		<button type='button' className='bh-name' onClick={start} title={t('boardHeader.renameHint')} aria-label={`${name}. ${t('boardHeader.rename')}`} data-i18n-ignore>
			<span className='bh-name__text'>{name}</span>
		</button>
	) : (
		<h1 className='bh-name bh-name--static' data-i18n-ignore><span className='bh-name__text'>{name}</span></h1>
	)
}

/**
 * Left side of the board's top bar: name (rename in place), star and who can see it.
 * Phones keep the name and the board switcher; the rest lives in the board menu.
 */
export const BoardTitle = ({ board, canEdit, onRename, isStarred, onToggleStar, canChangeVisibility, onVisibilityChange, onOpenSwitcher }) => {
	const { t } = useI18n()
	const visibility = board.visibility || 'private'
	const VisibilityIcon = VISIBILITY_ICONS[visibility] || LockKeyhole
	const visibilityName = t(`boards.visibility.${visibility}`)
	return (
		<div className='bh-title'>
			<BoardName key={board._id} name={board.name} canEdit={canEdit} onRename={onRename} />
			<IconButton
				className={cx('bh-star', isStarred && 'is-starred')}
				icon={Star}
				size='sm'
				label={isStarred ? t('boardHeader.unstar') : t('boardHeader.star')}
				aria-pressed={isStarred}
				onClick={onToggleStar}
			/>
			{canChangeVisibility ? (
				<Menu
					label={t('boardHeader.visibilityTitle')}
					align='start'
					trigger={(props) => (
						<button type='button' className='bh-chip bh-visibility' {...props} aria-label={t('boardHeader.visibilityLabel', { value: visibilityName })}>
							<VisibilityIcon size={14} aria-hidden='true' />
							<span>{visibilityName}</span>
							<ChevronDown size={13} aria-hidden='true' />
						</button>
					)}
					items={[
						{ heading: t('boardHeader.visibilityTitle') },
						...VISIBILITIES.map((value) => ({
							label: t(`boards.visibility.${value}`),
							icon: VISIBILITY_ICONS[value],
							checked: value === visibility,
							onSelect: () => value !== visibility && onVisibilityChange(value),
						})),
					]}
				/>
			) : (
				<span className='bh-chip bh-visibility is-static' title={t('boardHeader.visibilityLabel', { value: visibilityName })}>
					<VisibilityIcon size={14} aria-hidden='true' />
					<span>{visibilityName}</span>
				</span>
			)}
			<IconButton className='bh-phone-only' icon={Layers} size='sm' label={t('boardDock.switch')} onClick={onOpenSwitcher} />
		</div>
	)
}

/** Right side: who is on the board, Filter, Share and the board menu. */
export const BoardActions = ({ people, filterCount, onFilter, onShare, onMenu }) => {
	const { t } = useI18n()
	const filtered = filterCount > 0
	return (
		<div className='bh-actions'>
			{people.length > 0 && (
				<button type='button' className='bh-people' onClick={onShare} aria-label={`${t('boardHeader.people')}: ${people.map((person) => person.name).join(', ')}`}>
					<AvatarGroup people={people} max={4} size={28} />
				</button>
			)}
			<Button
				variant='secondary'
				size='sm'
				className={cx('bh-filter', filtered && 'is-active')}
				icon={filtered ? Check : Filter}
				onClick={onFilter}
				aria-label={filtered ? t('boardHeader.filtered', { count: filterCount }) : t('boardHeader.filter')}
				aria-keyshortcuts='F'
			>
				<span className='bh-label'>{t('boardHeader.filter')}</span>
				{filtered && <span className='bh-count'>{filterCount}</span>}
			</Button>
			<Button size='sm' className='bh-share' icon={UserPlus} onClick={onShare} aria-label={t('boardHeader.share')}>
				<span className='bh-label'>{t('boardHeader.share')}</span>
			</Button>
			<IconButton className='bh-menu' icon={MoreHorizontal} label={t('boardHeader.menu')} onClick={onMenu} />
		</div>
	)
}
