import { Bold, Code2, Italic, Link, List, ListOrdered, Strikethrough, Underline } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useI18n } from '../i18n'
import { sanitizeDescription } from '../lib/richText'

const toolbarItems = [
	{ command: 'bold', label: 'editor.bold', icon: Bold },
	{ command: 'italic', label: 'editor.italic', icon: Italic },
	{ command: 'underline', label: 'editor.underline', icon: Underline },
	{ command: 'strikeThrough', label: 'editor.strike', icon: Strikethrough },
	{ command: 'formatBlock', value: 'pre', label: 'editor.code', icon: Code2 },
	{ command: 'insertUnorderedList', label: 'editor.bullets', icon: List },
	{ command: 'insertOrderedList', label: 'editor.numbers', icon: ListOrdered },
]

const RichTextEditor = ({ value, onChange }) => {
	const { t } = useI18n()
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
		const url = window.prompt(t('editor.linkPrompt'))
		if (!url || !/^https?:\/\//i.test(url)) return
		runCommand('createLink', url)
	}

	return (
		<div className='rich-text-editor'>
			<div className='rich-text-toolbar' role='toolbar' aria-label={t('editor.toolbar')}>
				{toolbarItems.map(({ command, value: commandValue, label, icon: Icon }) => (
					<button
						key={label}
						type='button'
						className='rich-text-tool'
						onMouseDown={(event) => event.preventDefault()}
						onClick={() => runCommand(command, commandValue)}
						aria-label={t(label)}
						title={t(label)}
					>
						<Icon size={16} />
					</button>
				))}
				<button
					type='button'
					className='rich-text-tool'
					onMouseDown={(event) => event.preventDefault()}
					onClick={insertLink}
					aria-label={t('editor.link')}
					title={t('editor.link')}
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
				aria-label={t('editor.label')}
				aria-multiline='true'
				data-placeholder={t('editor.placeholder')}
			/>
		</div>
	)
}

export default RichTextEditor
