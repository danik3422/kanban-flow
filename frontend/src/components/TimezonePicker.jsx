import { Clock3, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

const TimezonePicker = ({ options, value, onChange, id }) => {
	const selectedOption = options.find((option) => option.value === value)
	const [query, setQuery] = useState(selectedOption?.label || '')
	const [isOpen, setIsOpen] = useState(false)
	const [highlightedIndex, setHighlightedIndex] = useState(0)
	const pickerRef = useRef(null)

	useEffect(() => {
		const handleOutsidePointer = (event) => {
			if (!pickerRef.current?.contains(event.target)) setIsOpen(false)
		}
		const handleEscape = (event) => {
			if (event.key === 'Escape') setIsOpen(false)
		}

		document.addEventListener('pointerdown', handleOutsidePointer)
		document.addEventListener('keydown', handleEscape)
		return () => {
			document.removeEventListener('pointerdown', handleOutsidePointer)
			document.removeEventListener('keydown', handleEscape)
		}
	}, [])

	const filteredOptions = useMemo(() => {
		const normalizedQuery = query.trim().toLowerCase()
		const matchingOptions = !normalizedQuery || query === selectedOption?.label
			? options
			: options.filter((option) => option.label.toLowerCase().includes(normalizedQuery))
		if (!selectedOption) return matchingOptions
		return [selectedOption, ...matchingOptions.filter((option) => option.value !== selectedOption.value)]
	}, [options, query, selectedOption])

	const chooseOption = (option) => {
		onChange(option.value)
		setQuery(option.label)
		setIsOpen(false)
	}

	const handleKeyDown = (event) => {
		if (event.key === 'ArrowDown') {
			event.preventDefault()
			setIsOpen(true)
			setHighlightedIndex((index) => Math.min(index + 1, filteredOptions.length - 1))
		}
		if (event.key === 'ArrowUp') {
			event.preventDefault()
			setIsOpen(true)
			setHighlightedIndex((index) => Math.max(index - 1, 0))
		}
		if (event.key === 'Enter' && isOpen && filteredOptions[highlightedIndex]) {
			event.preventDefault()
			chooseOption(filteredOptions[highlightedIndex])
		}
	}

	return (
		<div className='timezone-picker' ref={pickerRef}>
			<div className='setup-input-wrap'>
				<Clock3 size={16} />
				<input
					id={id}
					value={query}
					onChange={(event) => {
						setQuery(event.target.value)
						setIsOpen(true)
						setHighlightedIndex(0)
					}}
					onFocus={() => setIsOpen(true)}
					onKeyDown={handleKeyDown}
					placeholder='Search city or timezone'
					role='combobox'
					aria-expanded={isOpen}
					aria-controls={`${id}-options`}
					aria-activedescendant={isOpen && filteredOptions[highlightedIndex] ? `${id}-option-${highlightedIndex}` : undefined}
				/>
				<Search size={15} className='timezone-search-icon' />
			</div>
			{isOpen && (
				<div className='timezone-options' id={`${id}-options`} role='listbox'>
					{filteredOptions.length ? filteredOptions.map((option, index) => (
						<button
							key={option.value}
							id={`${id}-option-${index}`}
							type='button'
							className={index === highlightedIndex ? 'timezone-option is-highlighted' : 'timezone-option'}
							onMouseDown={(event) => event.preventDefault()}
							onMouseEnter={() => setHighlightedIndex(index)}
							onClick={() => chooseOption(option)}
						>
							{option.label}
						</button>
					)) : (
						<div className='timezone-empty'>No cities found</div>
					)}
				</div>
			)}
		</div>
	)
}

export default TimezonePicker
