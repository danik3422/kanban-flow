import { ArrowRight, FolderKanban, Plus, UsersRound } from 'lucide-react'

const BoardGroup = ({ title, description, boards, onOpenBoard }) => (
	<section className='rooms-overview-group'>
		<div className='rooms-overview-group-heading'><div><p className='eyebrow'>{title}</p><p>{description}</p></div><span>{boards.length}</span></div>
		{boards.length ? <div className='rooms-overview-grid'>{boards.map((board) => <button className='room-overview-card' key={board._id} onClick={() => onOpenBoard(board)}><span className='room-overview-icon'><FolderKanban size={19} /></span><span className='room-overview-copy'><strong>{board.name}</strong><small>{board.access === 'owned' ? 'Owned by you' : `Shared with you · ${board.role || 'member'}`}</small></span><ArrowRight size={17} /></button>)}</div> : <div className='rooms-overview-empty'>No rooms here yet.</div>}
	</section>
)

const WorkspaceOverview = ({ boards, onOpenBoard, onCreateBoard }) => {
	const ownedBoards = boards.filter((board) => board.access === 'owned' || !board.access)
	const invitedBoards = boards.filter((board) => board.access === 'invited')

	return (
		<div className='workspace-content rooms-overview'>
			<div className='workspace-heading'><div><p className='eyebrow'>Your rooms</p><h1>Everything in one place.</h1><p className='heading-copy'>Choose a room to jump into a board, or create a new one for the next project.</p></div><button className='primary-button' onClick={onCreateBoard}><Plus size={18} /> New room</button></div>
			<div className='rooms-overview-summary'><div><strong>{boards.length}</strong><span>rooms available</span></div><div><UsersRound size={17} /><span>Private workspace</span></div></div>
			<BoardGroup title='My boards' description='Rooms you own and manage.' boards={ownedBoards} onOpenBoard={onOpenBoard} />
			<BoardGroup title='Shared with me' description='Rooms other people invited you to join.' boards={invitedBoards} onOpenBoard={onOpenBoard} />
		</div>
	)
}

export default WorkspaceOverview
