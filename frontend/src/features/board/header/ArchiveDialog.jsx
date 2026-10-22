import { Archive, ArchiveRestore, Columns3, Search, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useI18n } from '../../../i18n'
import { translateServerMessageCurrent } from '../../../i18n/translate'
import { axiosInstance } from '../../../lib/axios'
import { relativeTime } from '../../../lib/relativeTime'
import { Button, ConfirmDialog, EmptyState, IconButton, Input, Modal, SegmentedControl, Skeleton } from '../../../ui'

/**
 * The board's archive: cards and lists put away instead of deleted. Anything here can
 * come back to the board, or be deleted for good (lists only by admins).
 */
const ArchiveDialog = ({ open, onClose, boardId, canManage, onRestored }) => {
	const { t, language } = useI18n()
	const [tab, setTab] = useState('cards')
	const [query, setQuery] = useState('')
	const [archive, setArchive] = useState(null)
	const [busyId, setBusyId] = useState(null)
	const [removing, setRemoving] = useState(null) // { kind, item }

	const load = useCallback(async () => {
		try {
			const { data } = await axiosInstance.get(`/board/boards/${boardId}/archive`)
			setArchive(data)
		} catch (error) {
			setArchive({ tasks: [], columns: [] })
			toast.error(translateServerMessageCurrent(error.response?.data?.message, 'archive.loadError'))
		}
	}, [boardId])

	const [wasOpen, setWasOpen] = useState(false)
	if (wasOpen !== open) {
		setWasOpen(open)
		if (open) {
			setArchive(null)
			setQuery('')
		}
	}
	useEffect(() => {
		if (open && boardId) queueMicrotask(load)
	}, [open, boardId, load])

	const act = async (id, request, success) => {
		setBusyId(id)
		try {
			await request()
			toast.success(t(success))
			await load()
			onRestored?.()
		} catch (error) {
			toast.error(translateServerMessageCurrent(error.response?.data?.message, 'archive.actionError'))
		} finally {
			setBusyId(null)
		}
	}
	const restoreTask = (task) => act(task._id, () => axiosInstance.post(`/board/tasks/${task._id}/restore`), 'archive.cardRestored')
	const restoreColumn = (column) => act(column._id, () => axiosInstance.post(`/board/columns/${column._id}/restore`), 'archive.listRestored')
	const removeForGood = () => {
		const { kind, item } = removing
		setRemoving(null)
		return kind === 'card'
			? act(item._id, () => axiosInstance.delete(`/board/tasks/${item._id}`), 'archive.cardDeleted')
			: act(item._id, () => axiosInstance.delete(`/board/columns/${item._id}`), 'archive.listDeleted')
	}

	const needle = query.trim().toLowerCase()
	const tasks = (archive?.tasks || []).filter((task) => !needle || task.title.toLowerCase().includes(needle))
	const columns = (archive?.columns || []).filter((column) => !needle || column.title.toLowerCase().includes(needle))
	const when = (item) => [item.archivedBy?.name || item.archivedBy?.email, relativeTime(item.archivedAt, language, t('boards.justNow'))].filter(Boolean).join(' · ')

	const row = ({ id, icon: Icon, title, meta, onRestore, onDelete }) => (
		<li key={id} className='ar-row'>
			<span className='ar-row__icon' aria-hidden='true'><Icon size={16} /></span>
			<span className='ar-row__text'>
				<span className='ar-row__title' data-i18n-ignore>{title}</span>
				<span className='ar-row__meta' data-i18n-ignore>{meta}</span>
			</span>
			<span className='ar-row__actions'>
				{onRestore && <Button variant='secondary' size='sm' icon={ArchiveRestore} loading={busyId === id} onClick={onRestore}>{t('archive.restore')}</Button>}
				{onDelete && <IconButton icon={Trash2} size='sm' label={t('archive.deleteForGood')} className='ar-row__delete' onClick={onDelete} disabled={busyId === id} />}
			</span>
		</li>
	)

	let body
	if (!archive) {
		body = <ul className='ar-list'>{[0, 1, 2].map((index) => <li key={index} className='ar-row'><Skeleton height={40} radius={10} /></li>)}</ul>
	} else if (tab === 'cards') {
		body = tasks.length ? (
			<ul className='ar-list'>
				{tasks.map((task) => row({
					id: task._id,
					icon: Archive,
					title: task.title,
					meta: [task.columnTitle, when(task)].filter(Boolean).join(' · '),
					onRestore: () => restoreTask(task),
					onDelete: () => setRemoving({ kind: 'card', item: task }),
				}))}
			</ul>
		) : <EmptyState icon={Archive} title={needle ? t('archive.nothingFound') : t('archive.noCards')} description={needle ? undefined : t('archive.noCardsText')} />
	} else {
		body = columns.length ? (
			<ul className='ar-list'>
				{columns.map((column) => row({
					id: column._id,
					icon: Columns3,
					title: column.title,
					meta: [t('archive.cardCount', { count: column.taskCount }), when(column)].join(' · '),
					onRestore: canManage ? () => restoreColumn(column) : undefined,
					onDelete: canManage ? () => setRemoving({ kind: 'list', item: column }) : undefined,
				}))}
			</ul>
		) : <EmptyState icon={Columns3} title={needle ? t('archive.nothingFound') : t('archive.noLists')} description={needle ? undefined : t('archive.noListsText')} />
	}

	return (
		<>
			<Modal open={open && !removing} onClose={onClose} title={t('archive.title')} variant='panel' className='ar-dialog'>
				<div className='ar'>
					<SegmentedControl
						label={t('archive.title')}
						value={tab}
						onChange={setTab}
						options={[
							{ value: 'cards', label: archive ? `${t('archive.cards')} ${archive.tasks.length}` : t('archive.cards') },
							{ value: 'lists', label: archive ? `${t('archive.lists')} ${archive.columns.length}` : t('archive.lists') },
						]}
					/>
					<Input icon={Search} type='search' value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('archive.search')} aria-label={t('archive.search')} />
					{body}
				</div>
			</Modal>
			<ConfirmDialog
				open={Boolean(removing)}
				onClose={() => setRemoving(null)}
				onConfirm={removeForGood}
				title={removing?.kind === 'list' ? t('archive.deleteListTitle', { title: removing?.item.title }) : t('archive.deleteCardTitle', { title: removing?.item.title })}
				description={removing?.kind === 'list' ? t('archive.deleteListText') : t('archive.deleteCardText')}
				confirmLabel={t('archive.deleteForGood')}
			/>
		</>
	)
}

export default ArchiveDialog
