import { CalendarPlus, Check, Copy, Info, Link2Off, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useI18n } from '../../i18n'
import { translateServerMessageCurrent } from '../../i18n/translate'
import { axiosInstance } from '../../lib/axios'
import { isDevAuthBypass } from '../../lib/devMode'
import { Alert, Button, Checkbox, ConfirmDialog, Input, Modal, SegmentedControl, Skeleton } from '../../ui'
import { feedUrl, googleCalendarUrl, isLocalAddress, outlookCalendarUrl, webcalUrl } from './calendarFeedUrls'
import './calendar-link.css'

/**
 * The calendar link: cards with dates in Google, Apple or Outlook calendar, kept up to
 * date by the calendar app itself. Off until the person turns it on; one secret address
 * per account, narrowed to a board when `board` is given.
 */
export const CalendarLink = ({ board = null }) => {
	const { t } = useI18n()
	const [token, setToken] = useState(null)
	const [loading, setLoading] = useState(!isDevAuthBypass)
	const [busy, setBusy] = useState(false)
	const [scope, setScope] = useState('mine')
	const [done, setDone] = useState(true)
	const [copied, setCopied] = useState(false)
	const [confirm, setConfirm] = useState(null)

	useEffect(() => {
		if (isDevAuthBypass) return undefined
		let alive = true
		axiosInstance.get('/calendar/link')
			.then(({ data }) => alive && setToken(data.token))
			.catch(() => alive && setToken(null))
			.finally(() => alive && setLoading(false))
		return () => {
			alive = false
		}
	}, [])

	const request = async (action, fallback) => {
		setBusy(true)
		try {
			await action()
			return true
		} catch (error) {
			toast.error(translateServerMessageCurrent(error.response?.data?.message, fallback))
			return false
		} finally {
			setBusy(false)
		}
	}
	const turnOn = () => request(async () => setToken((await axiosInstance.post('/calendar/link', {})).data.token), 'calendarLink.error')
	const reset = async () => {
		const ok = await request(async () => setToken((await axiosInstance.post('/calendar/link', { reset: true })).data.token), 'calendarLink.error')
		setConfirm(null)
		if (ok) toast.success(t('calendarLink.resetDone'))
	}
	const turnOff = async () => {
		const ok = await request(async () => {
			await axiosInstance.delete('/calendar/link')
			setToken(null)
		}, 'calendarLink.error')
		setConfirm(null)
		if (ok) toast.success(t('calendarLink.offDone'))
	}

	if (loading) return <Skeleton height={96} radius={12} />

	if (!token) {
		return (
			<div className='clk clk--off'>
				<p className='clk__text'>{t(board ? 'calendarLink.offBoard' : 'calendarLink.offText')}</p>
				<Button icon={CalendarPlus} onClick={turnOn} loading={busy} disabled={isDevAuthBypass}>{t('calendarLink.turnOn')}</Button>
			</div>
		)
	}

	const url = feedUrl(token, { scope, board, done })
	const name = t(board ? 'calendarLink.nameBoard' : scope === 'all' ? 'calendarLink.nameAll' : 'calendarLink.nameMine')
	const local = isLocalAddress(url)
	const copy = async () => {
		try {
			await navigator.clipboard.writeText(url)
			setCopied(true)
			window.setTimeout(() => setCopied(false), 1600)
		} catch {
			toast.error(t('calendarLink.copyError'))
		}
	}

	return (
		<div className='clk'>
			{!board && (
				<SegmentedControl
					label={t('calendarLink.scope')}
					value={scope}
					onChange={setScope}
					options={[{ value: 'mine', label: t('calendarLink.mine') }, { value: 'all', label: t('calendarLink.all') }]}
				/>
			)}
			<Checkbox checked={done} onChange={(event) => setDone(event.target.checked)} label={t('calendarLink.showDone')} />
			<div className='clk__url'>
				<Input value={url} readOnly aria-label={t('calendarLink.address')} onFocus={(event) => event.target.select()} data-i18n-ignore />
				<Button variant='secondary' icon={copied ? Check : Copy} onClick={copy}>{copied ? t('calendarLink.copied') : t('calendarLink.copy')}</Button>
			</div>
			<div className='clk__apps'>
				<Button as='a' variant='secondary' size='sm' href={googleCalendarUrl(url)} target='_blank' rel='noopener noreferrer'>Google</Button>
				<Button as='a' variant='secondary' size='sm' href={webcalUrl(url)}>Apple</Button>
				<Button as='a' variant='secondary' size='sm' href={outlookCalendarUrl(url, name)} target='_blank' rel='noopener noreferrer'>Outlook</Button>
			</div>
			<p className='clk__hint'>{t('calendarLink.refreshHint')}</p>
			{local && <Alert icon={Info} className='clk__local'>{t('calendarLink.localHint')}</Alert>}
			<p className='clk__hint'>{t('calendarLink.secretHint')}</p>
			<div className='clk__manage'>
				<Button variant='ghost' size='sm' icon={RefreshCw} onClick={() => setConfirm('reset')}>{t('calendarLink.reset')}</Button>
				<Button variant='ghost' size='sm' icon={Link2Off} onClick={() => setConfirm('off')}>{t('calendarLink.turnOff')}</Button>
			</div>
			<ConfirmDialog
				open={confirm === 'reset'}
				onClose={() => setConfirm(null)}
				onConfirm={reset}
				loading={busy}
				tone='primary'
				title={t('calendarLink.resetTitle')}
				description={t('calendarLink.resetText')}
				confirmLabel={t('calendarLink.reset')}
			/>
			<ConfirmDialog
				open={confirm === 'off'}
				onClose={() => setConfirm(null)}
				onConfirm={turnOff}
				loading={busy}
				title={t('calendarLink.offTitle')}
				description={t('calendarLink.offConfirm')}
				confirmLabel={t('calendarLink.turnOff')}
			/>
		</div>
	)
}

/** The calendar link in a dialog: from the calendar page and the board menu. */
export const CalendarLinkDialog = ({ open, onClose, board = null, boardName = '' }) => {
	const { t } = useI18n()
	return (
		<Modal
			open={open}
			onClose={onClose}
			size='sm'
			title={board ? t('calendarLink.boardTitle') : t('calendarLink.title')}
			description={board ? t('calendarLink.boardText', { name: boardName }) : t('calendarLink.text')}
		>
			{open && <CalendarLink board={board} />}
		</Modal>
	)
}

export default CalendarLink
