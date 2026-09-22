import { useEffect, useRef } from 'react'

const Popover = ({ isOpen, onClose, className = '', children, ...props }) => {
	const popoverRef = useRef(null)

	useEffect(() => {
		if (!isOpen) return undefined

		const handlePointerDown = (event) => {
			if (!popoverRef.current?.contains(event.target)) onClose()
		}
		const handleKeyDown = (event) => {
			if (event.key === 'Escape') onClose()
		}

		document.addEventListener('pointerdown', handlePointerDown)
		document.addEventListener('keydown', handleKeyDown)
		return () => {
			document.removeEventListener('pointerdown', handlePointerDown)
			document.removeEventListener('keydown', handleKeyDown)
		}
	}, [isOpen, onClose])

	return (
		<div ref={popoverRef} className={className} {...props}>
			{children}
		</div>
	)
}

export default Popover
