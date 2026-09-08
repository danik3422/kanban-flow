import { Link2, Mail, X } from 'lucide-react'
import { useState } from 'react'

const InviteMemberModal = ({ email, isOpen, onChange, onClose, onSubmit }) => {
	const [mode, setMode] = useState('email')
	if (!isOpen) return null

	return (
		<div className='modal-backdrop' onMouseDown={onClose}>
			<form className='modal-panel' onSubmit={(event) => onSubmit(event, mode)} onMouseDown={(event) => event.stopPropagation()}>
				<div className='modal-title'>
					<div><p className='eyebrow'>Collaborate</p><h2>Invite a teammate</h2></div>
					<button type='button' className='icon-button' onClick={onClose} aria-label='Close' title='Close'><X size={18} /></button>
				</div>
				<div className='invite-mode-switch' role='tablist' aria-label='Invite method'><button type='button' className={mode === 'email' ? 'active' : ''} onClick={() => setMode('email')}><Mail size={15} /> Invite by email</button><button type='button' className={mode === 'link' ? 'active' : ''} onClick={() => setMode('link')}><Link2 size={15} /> Copy invite link</button></div>
				{mode === 'email' ? <><p>We will send a one-time invite link to this email address. They can register first if they do not have an account.</p><label className='field-label' htmlFor='invite-email'>Email address</label><input id='invite-email' type='email' autoFocus value={email} onChange={onChange} placeholder='teammate@example.com' required /><button className='primary-button full-button' type='submit'><Mail size={17} /> Send invitation</button></> : <><p>Create a one-time link that you can send anywhere. It expires in 7 days and works once.</p><button className='primary-button full-button' type='submit'><Link2 size={17} /> Create invite link</button></>}
			</form>
		</div>
	)
}

export default InviteMemberModal
