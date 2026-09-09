import { Bold, Code2, Italic, Link, List, ListOrdered, Strikethrough, Underline } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { sanitizeDescription } from '../lib/richText'

const toolbarItems = [
	{ command: 'bold', label: 'Bold', icon: Bold },
	{ command: 'italic', label: 'Italic', icon: Italic },
	{ command: 'underline', label: 'Underline', icon: Underline },
	{ command: 'strikeThrough', label: 'Strikethrough', icon: Strikethrough },
	{ command: 'formatBlock', value: 'pre', label: 'Code', icon: Code2 },
	{ command: 'insertUnorderedList', label: 'Bulleted list', icon: List },
	{ command: 'insertOrderedList', label: 'Numbered list', icon: ListOrdered },
]

const RichTextEditor = ({ value, onChange }) => {
	const editorRef = useRef(null)

	useEffect(() => {
		if (editorRef.current && editorRef.current.innerHTML !== value) {
			editorRef.current.innerHTML = sanitizeDescription(value)
		}
	}, [value])

	const emitChange = () => {
		if (!editorRef.current) return
		onChange(sanitizeDescription(editorRef.current.innerHTML))
	}

	const runCommand = (command, commandValue = null) => {
		editorRef.current?.focus()
		document.execCommand(command, false, commandValue)
		emitChange()
	}

	const insertLink = () => {
		const url = window.prompt('Enter a URL')
		if (!url || !/^https?:\/\//i.test(url)) return
		runCommand('createLink', url)
	}

	return (
		<div className='rich-text-editor'>
			<div className='rich-text-toolbar' role='toolbar' aria-label='Text formatting'>
				{toolbarItems.map(({ command, value: commandValue, label, icon: Icon }) => (
					<button
						key={label}
						type='button'
						className='rich-text-tool'
						onMouseDown={(event) => event.preventDefault()}
						onClick={() => runCommand(command, commandValue)}
						aria-label={label}
						title={label}
					>
						<Icon size={16} />
					</button>
				))}
				<button
					type='button'
					className='rich-text-tool'
					onMouseDown={(event) => event.preventDefault()}
					onClick={insertLink}
					aria-label='Add link'
					title='Add link'
				>
					<Link size={16} />
				</button>
			</div>
			<div
				ref={editorRef}
				className='rich-text-input'
				contentEditable
				suppressContentEditableWarning
				onInput={emitChange}
				role='textbox'
				aria-label='Description'
				aria-multiline='true'
				data-placeholder='Add a description'
			/>
		</div>
	)
}

export default RichTextEditor
