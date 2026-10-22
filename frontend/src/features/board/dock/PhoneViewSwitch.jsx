import { CalendarDays, Columns3, Table2 } from 'lucide-react'
import { useI18n } from '../../../i18n'
import { cx } from '../../../ui/utils'

const VIEWS = [
	{ key: 'board', icon: Columns3, label: 'boardDock.board' },
	{ key: 'table', icon: Table2, label: 'boardDock.table' },
	{ key: 'planner', icon: CalendarDays, label: 'boardDock.plannerShort' },
]

/** On phones, where there is no room for the dock: board, table or planner, one at a time. */
const PhoneViewSwitch = ({ value, onChange }) => {
	const { t } = useI18n()
	return (
		<div className='pv' role='tablist' aria-label={t('boardDock.label')}>
			{VIEWS.map(({ key, icon: Icon, label }) => (
				<button key={key} type='button' role='tab' aria-selected={value === key} className={cx('pv__item', value === key && 'is-active')} onClick={() => onChange(key)}>
					<Icon size={16} aria-hidden='true' />
					<span>{t(label)}</span>
				</button>
			))}
		</div>
	)
}

export default PhoneViewSwitch
