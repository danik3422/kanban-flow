import { Activity, Archive, CalendarDays, Zap, ChevronsLeftRight, ChevronsRightLeft, Copy, Download, FileJson, FileSpreadsheet, Image as ImageIcon, Info, Keyboard, Link2, LogOut, Star, Trash2, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { useI18n } from '../../../i18n'
import { translateServerMessageCurrent } from '../../../i18n/translate'
import { downloadFromApi } from '../../../lib/download'
import { Avatar, Button, Checkbox, EmptyState, Field, Input, Modal, RadioCards, Textarea } from '../../../ui'
import { cx } from '../../../ui/utils'
import { relativeTime } from '../../../lib/relativeTime'
import { VISIBILITIES, VISIBILITY_ICONS } from './boardVisibility'
import { canAutoFocusTyping } from '../../../lib/autoFocus'


const Item = ({ icon: Icon, label, hint, onClick, tone }) => (
	<button type='button' className={cx('bh-menu-item', tone === 'danger' && 'is-danger')} onClick={onClick}>
		<span className='bh-menu-item__icon' aria-hidden='true'><Icon size={18} /></span>
		<span className='bh-menu-item__text'>
			<span className='bh-menu-item__label'>{label}</span>
			{hint && <span className='bh-menu-item__hint'>{hint}</span>}
		</span>
	</button>
)

/**
 * The board menu (Trello's right-hand "Menu"): about the board, sharing, visibility,
 * background, activity, copying, and leaving or deleting. A side panel on wide
 * screens, a bottom sheet on phones; each part opens in place with a back arrow.
 */
const BoardMenu = ({
	open,
	onClose,
	board,
	canManage,
	isOwner,
	isStarred,
	admins,
	activities,
	activityLoading,
	onSaveDescription,
	onShare,
	onVisibilityChange,
	onBackground,
	onToggleStar,
	onCopyLink,
	onCopyBoard,
	onLeave,
	onDelete,
	onArchive,
	onShortcuts,
	onCalendar,
	onAutomation,
	listCount = 0,
	collapsedCount = 0,
	onCollapseAll,
	onExpandAll,
}) => {
	const { t, language } = useI18n()
	const [view, setView] = useState('main')
	const [description, setDescription] = useState('')
	const [copyName, setCopyName] = useState('')
	const [keepCards, setKeepCards] = useState(true)
	const [busy, setBusy] = useState(false)
	const [wasOpen, setWasOpen] = useState(open)
	if (wasOpen !== open) {
		setWasOpen(open)
		if (open) setView('main')
	}

	const go = (next) => {
		if (next === 'about') setDescription(board?.description || '')
		if (next === 'copy') {
			setCopyName(t('boardHeader.copySuffix', { name: board?.name || '' }))
			setKeepCards(true)
		}
		setView(next)
	}
	const visibility = board?.visibility || 'private'
	const titles = { export: t('boardHeader.export'), main: t('boardHeader.menuTitle'), about: t('boardHeader.about'), visibility: t('boardHeader.visibilityItem'), activity: t('boardHeader.activity'), copy: t('boardHeader.copy') }

	const saveDescription = async (event) => {
		event.preventDefault()
		setBusy(true)
		const ok = await onSaveDescription(description)
		setBusy(false)
		if (ok) setView('main')
	}
	const copy = async (event) => {
		event.preventDefault()
		if (!copyName.trim()) return
		setBusy(true)
		const ok = await onCopyBoard(copyName.trim(), keepCards)
		setBusy(false)
		if (ok) onClose()
	}
	const exportAs = async (format) => {
		if (busy) return
		setBusy(true)
		try {
			await downloadFromApi(`/board/boards/${board._id}/export${format === 'csv' ? '?format=csv' : ''}`, `board.${format}`)
			toast.success(t('boardHeader.exported'))
		} catch (error) {
			toast.error(translateServerMessageCurrent(error.response?.data?.message, 'boardHeader.exportError'))
		} finally {
			setBusy(false)
		}
	}
	const closeAnd = (action) => () => {
		onClose()
		action()
	}

	return (
		<Modal open={open} onClose={onClose} onBack={view === 'main' ? undefined : () => setView('main')} title={titles[view]} variant='panel' className='bh-menu-modal'>
			{view === 'main' && (
				<div className='bh-menu-body'>
					<button type='button' className='bh-about' onClick={() => go('about')}>
						<span className='bh-about__head'><Info size={16} aria-hidden='true' /> {t('boardHeader.about')}</span>
						<span className={cx('bh-about__text', !board?.description && 'is-empty')} data-i18n-ignore={board?.description ? true : undefined}>
							{board?.description || t('boardHeader.descriptionEmpty')}
						</span>
						{admins.length > 0 && (
							<span className='bh-about__admins'>
								<span className='bh-muted'>{t('boardHeader.admins')}</span>
								{admins.slice(0, 5).map((person) => <Avatar key={person._id} name={person.name || person.email} src={person.avatar} size={24} />)}
							</span>
						)}
					</button>
					<div className='bh-menu-group'>
						<Item icon={UserPlus} label={t('boardHeader.shareItem')} onClick={closeAnd(onShare)} />
						<Item icon={VISIBILITY_ICONS[visibility]} label={t('boardHeader.visibilityItem')} hint={t(`boards.visibility.${visibility}`)} onClick={() => go('visibility')} />
						{canManage && <Item icon={ImageIcon} label={t('boardHeader.background')} onClick={closeAnd(onBackground)} />}
						<Item icon={Activity} label={t('boardHeader.activity')} onClick={() => go('activity')} />
						{onAutomation && <Item icon={Zap} label={t('boardHeader.automationItem')} hint={t('automation.menuHint')} onClick={closeAnd(onAutomation)} />}
						<Item icon={Archive} label={t('boardHeader.archive')} onClick={closeAnd(onArchive)} />
						{onCalendar && <Item icon={CalendarDays} label={t('boardHeader.calendarItem')} hint={t('boardHeader.calendarHint')} onClick={closeAnd(onCalendar)} />}
						<Item icon={Download} label={t('boardHeader.export')} onClick={() => go('export')} />
						{onShortcuts && <Item icon={Keyboard} label={t('shortcuts.title')} hint='?' onClick={closeAnd(onShortcuts)} />}
					</div>
					<div className='bh-menu-group'>
						<Item icon={Star} label={isStarred ? t('boardHeader.unstar') : t('boardHeader.star')} onClick={onToggleStar} />
						{listCount > 0 && collapsedCount < listCount && <Item icon={ChevronsRightLeft} label={t('boardHeader.collapseAll')} onClick={closeAnd(onCollapseAll)} />}
						{collapsedCount > 0 && <Item icon={ChevronsLeftRight} label={t('boardHeader.expandAll')} onClick={closeAnd(onExpandAll)} />}
						<Item icon={Copy} label={t('boardHeader.copy')} onClick={() => go('copy')} />
						<Item icon={Link2} label={t('boardHeader.copyLink')} onClick={onCopyLink} />
					</div>
					<div className='bh-menu-group'>
						{isOwner
							? <Item icon={Trash2} label={t('boardHeader.delete')} tone='danger' onClick={closeAnd(onDelete)} />
							: <Item icon={LogOut} label={t('boardHeader.leave')} tone='danger' onClick={closeAnd(onLeave)} />}
					</div>
				</div>
			)}

			{view === 'about' && (
				canManage ? (
					<form className='bh-menu-form' onSubmit={saveDescription}>
						<Field label={t('boardHeader.about')} hint={t('boardHeader.aboutText')}>
							<Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder={t('boardHeader.descriptionPlaceholder')} maxLength={1000} rows={6} autoFocus={canAutoFocusTyping()} />
						</Field>
						<Button type='submit' loading={busy} disabled={description.trim() === (board?.description || '')}>{t('common.save')}</Button>
					</form>
				) : (
					<p className={cx('bh-about-read', !board?.description && 'bh-muted')} data-i18n-ignore={board?.description ? true : undefined}>{board?.description || t('boardHeader.descriptionEmpty')}</p>
				)
			)}

			{view === 'export' && (
				<div className='bh-menu-body'>
					<p className='bh-muted bh-export-text'>{t('boardHeader.exportText')}</p>
					<div className='bh-menu-group'>
						<Item icon={FileJson} label={t('boardHeader.exportJson')} hint={t('boardHeader.exportJsonHint')} onClick={() => exportAs('json')} />
						<Item icon={FileSpreadsheet} label={t('boardHeader.exportCsv')} hint={t('boardHeader.exportCsvHint')} onClick={() => exportAs('csv')} />
					</div>
				</div>
			)}

			{view === 'visibility' && (
				<RadioCards
					legend={t('boardHeader.visibilityTitle')}
					name='board-menu-visibility'
					value={visibility}
					onChange={(value) => canManage && value !== visibility && onVisibilityChange(value)}
					options={VISIBILITIES.map((value) => ({
						value,
						icon: VISIBILITY_ICONS[value],
						label: t(`boards.visibility.${value}`),
						description: t(`boards.create.${value}Hint`),
					}))}
					className={cx('bh-visibility-cards', !canManage && 'is-readonly')}
				/>
			)}

			{view === 'activity' && (
				activityLoading ? null : activities?.length ? (
					<ol className='bh-activity'>
						{activities.slice(0, 60).map((item) => (
							<li key={item._id} className='bh-activity__item'>
								<Avatar name={item.user?.name || item.user?.email || '?'} src={item.user?.avatar} size={30} />
								<span className='bh-activity__text'>
									<span><strong data-i18n-ignore>{item.user?.name || item.user?.email}</strong> {item.details || `${item.action} ${item.entityName || ''}`}</span>
									<time className='bh-muted' dateTime={item.createdAt}>{relativeTime(item.createdAt, language, t('boards.justNow'))}</time>
								</span>
							</li>
						))}
					</ol>
				) : (
					<EmptyState icon={Activity} title={t('boardHeader.activityEmpty')} />
				)
			)}

			{view === 'copy' && (
				<form className='bh-menu-form' onSubmit={copy}>
					<Field label={t('boardHeader.copyName')}>
						<Input value={copyName} onChange={(event) => setCopyName(event.target.value)} maxLength={100} autoFocus={canAutoFocusTyping()} />
					</Field>
					<Checkbox checked={keepCards} onChange={(event) => setKeepCards(event.target.checked)} label={t('boardHeader.copyKeep')} />
					<p className='bh-muted'>{t('boardHeader.copyKeepHint')}</p>
					<Button type='submit' icon={Copy} loading={busy} disabled={!copyName.trim()}>{t('boardHeader.copyAction')}</Button>
				</form>
			)}
		</Modal>
	)
}

export default BoardMenu
