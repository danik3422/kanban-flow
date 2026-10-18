import { useI18n } from '../../i18n'
import { Avatar, AvatarGroup } from '../../ui'
import { cx } from '../../ui/utils'
import BoardTile from '../app/BoardTile'

/** The board someone is invited to: its face, size and the people already on it. */
export const InviteBoardCard = ({ details, compact = false }) => {
	const { t } = useI18n()
	const board = { _id: details.boardId, name: details.boardName }
	return (
		<div className={cx('inv-board', compact && 'inv-board--compact')}>
			<BoardTile board={board} size={compact ? 44 : 56} />
			<div className='inv-board__text'>
				<span className='inv-board__name' data-i18n-ignore>{details.boardName}</span>
				<span className='inv-board__meta'>
					{t('invite.members', { count: details.memberCount })} · {t('invite.tasks', { count: details.taskCount })}
				</span>
			</div>
			{details.members?.length > 0 && <AvatarGroup people={details.members} max={compact ? 3 : 5} size={compact ? 26 : 30} />}
		</div>
	)
}

/** Brand-panel scene for the invite page: the real board, and who invited you. */
const InviteScene = ({ details, showInviter = true }) => {
	const { t } = useI18n()
	if (!details) return null
	const inviter = details.invitedBy?.name || details.invitedBy?.email
	return (
		<div className='auth-scene inv-scene'>
			<div className='auth-scene__card'>
				<InviteBoardCard details={details} />
			</div>
			{inviter && showInviter && (
				<div className='auth-scene__toast'>
					<Avatar name={inviter} src={details.invitedBy?.avatar} size={32} decorative />
					<span data-i18n-ignore>{t('invite.invitedBy', { name: inviter })}</span>
				</div>
			)}
		</div>
	)
}

export default InviteScene
