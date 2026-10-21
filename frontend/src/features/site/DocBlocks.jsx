import { Check, Copy, Info, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { useI18n } from '../../i18n'
import { cx } from '../../ui/utils'

/** Text with `code` in backticks, as the guide's translations write it. */
export const Rich = ({ text, as: Tag = 'p', className }) => (
	<Tag className={className}>
		{String(text).split(/`([^`]+)`/).map((part, index) => (index % 2 ? <code key={index} className='doc-inline'>{part}</code> : part))}
	</Tag>
)

/**
 * A command or file to copy. Shell commands get a "$" prompt that is not copied, and
 * "#" lines read as comments; long lines scroll sideways instead of breaking mid-word.
 */
export const CodeBlock = ({ code, label, kind = 'shell', className }) => {
	const { t } = useI18n()
	const [copied, setCopied] = useState(false)
	const copy = async () => {
		try {
			await navigator.clipboard.writeText(code)
			setCopied(true)
			window.setTimeout(() => setCopied(false), 1600)
		} catch {
			// Clipboard blocked (plain http): the text can still be selected by hand.
		}
	}
	return (
		<figure className={cx('doc-code', className)}>
			<figcaption className='doc-code__bar'>
				<span className='doc-code__label'>{label || t('selfHosting.terminal')}</span>
				<button type='button' className={cx('doc-code__copy', copied && 'is-copied')} onClick={copy} aria-label={copied ? t('selfHosting.copied') : `${t('selfHosting.copy')}: ${label || t('selfHosting.terminal')}`}>
					{copied ? <Check size={14} aria-hidden='true' /> : <Copy size={14} aria-hidden='true' />}
					<span className='doc-code__copy-text'>{copied ? t('selfHosting.copied') : t('selfHosting.copy')}</span>
				</button>
			</figcaption>
			<pre className={`doc-code__body doc-code__body--${kind}`} data-i18n-ignore>
				<code>
					{code.split('\n').map((line, index) => (
						<span key={index} className={cx('doc-code__line', kind === 'shell' && (line.startsWith('#') ? 'is-comment' : 'is-command'))}>{line}{'\n'}</span>
					))}
				</code>
			</pre>
		</figure>
	)
}

/** A note beside the steps: `info` for good to know, `warning` for things that bite. */
export const Callout = ({ tone = 'info', children }) => {
	const Icon = tone === 'warning' ? TriangleAlert : Info
	return (
		<div className={cx('doc-callout', `doc-callout--${tone}`)}>
			<Icon size={18} aria-hidden='true' />
			<div className='doc-callout__body'>{children}</div>
		</div>
	)
}
