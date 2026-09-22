export const handleAvatarError = (event) => {
	event.currentTarget.onerror = null
	event.currentTarget.src = '/avatar.png'
	event.currentTarget.classList.add('is-default-avatar')
}
