import { ArrowRight, FolderKanban, Plus, UsersRound } from 'lucide-react'

const visibilityLabel = {
	private: 'Private',
	workspace: 'Workspace',
	public: 'Public',
}

const BoardGroup = ({ title, description, boards, onOpenBoard, emptyAction }) => (
	<section className='rooms-overview-group'>
		<div className='rooms-overview-group-heading'><div><p className='eyebrow'>{title}</p><p>{description}</p></div><span>{boards.length}</span></div>
		{boards.length ? <div className='rooms-overview-grid'>{boards.map((board) => <button className='room-overview-card' key={board._id} onClick={() => onOpenBoard(board)} aria-label={`Open room ${board.name}`}><span className='room-overview-icon'><FolderKanban size={19} /></span><span className='room-overview-copy'><strong>{board.name}</strong><small>{board.access === 'owned' ? 'Owned by you' : `Shared with you · ${board.role || 'member'}`}</small></span><span className={`room-overview-visibility visibility-${board.visibility || 'private'}`}>{visibilityLabel[board.visibility] || 'Private'}</span><ArrowRight size={17} /></button>)}</div> : <div className='rooms-overview-empty'><span className='rooms-overview-empty-icon'><FolderKanban size={18} /></span><div><strong>{emptyAction ? 'Create your first room' : 'No shared rooms yet'}</strong><span>{emptyAction ? 'Give your next project a home and invite your team when you are ready.' : 'Rooms shared with you will appear here.'}</span></div>{emptyAction && <button type='button' className='rooms-overview-empty-action' onClick={emptyAction}>Create room</button>}</div>}
	</section>
)

const WorkspaceOverview = ({ boards, onOpenBoard, onCreateBoard }) => {
	const ownedBoards = boards.filter((board) => board.access === 'owned' || !board.access)
	const invitedBoards = boards.filter((board) => board.access === 'invited')

	return (
		<div className='workspace-content rooms-overview'>
			<div className='workspace-heading'><div><p className='eyebrow'>Your rooms</p><h1>Everything in one place.</h1><p className='heading-copy'>Choose a room to jump into a board, or create a new one for the next project.</p></div><button className='primary-button' onClick={onCreateBoard}><Plus size={18} /> New room</button></div>
			<div className='rooms-overview-summary'><div><strong>{boards.length}</strong><span>{boards.length === 1 ? 'room available' : 'rooms available'}</span></div><div><UsersRound size={17} /><span>{ownedBoards.length} owned · {invitedBoards.length} shared</span></div></div>
			<BoardGroup title='My boards' description='Rooms you own and manage.' boards={ownedBoards} onOpenBoard={onOpenBoard} emptyAction={onCreateBoard} />
			<BoardGroup title='Shared with me' description='Rooms other people invited you to join.' boards={invitedBoards} onOpenBoard={onOpenBoard} />
		</div>
	)
}

export default WorkspaceOverview
