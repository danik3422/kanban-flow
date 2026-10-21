// The look shared by every email: table layout (Outlook, Gmail, Apple Mail), inline
// styles with a dark-mode stylesheet for the clients that read it, and the brand.

export const esc = (value = '') => String(value)
	.replaceAll('&', '&amp;')
	.replaceAll('<', '&lt;')
	.replaceAll('>', '&gt;')
	.replaceAll('"', '&quot;')
	.replaceAll("'", '&#039;')

const FONT = "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
const C = {
	page: '#eef3f1',
	card: '#ffffff',
	border: '#dde7e3',
	text: '#10201d',
	text2: '#3f504c',
	muted: '#6b7b77',
	accent: '#0f766e',
	accentSoft: '#e3f3f0',
	accentText: '#0b5d57',
	soft: '#f6faf9',
}

// Tones for the small label above the title and the dots in digests.
export const TONES = {
	accent: { bg: '#e3f3f0', fg: '#0b5d57', dot: '#14b8a6' },
	blue: { bg: '#e6effc', fg: '#1d4f91', dot: '#3b82f6' },
	amber: { bg: '#fdf1dc', fg: '#8a5300', dot: '#f59e0b' },
	red: { bg: '#fde8e7', fg: '#a1281f', dot: '#ef4444' },
	violet: { bg: '#efe9fd', fg: '#5b34b0', dot: '#8b5cf6' },
	gray: { bg: '#edf1f0', fg: '#3f504c', dot: '#94a3a0' },
}

export const label = (text, tone = 'accent') => {
	const t = TONES[tone] || TONES.accent
	return `<span class="kh-label" style="display:inline-block;padding:4px 10px;border-radius:999px;background:${t.bg};color:${t.fg};font-size:12px;font-weight:700;letter-spacing:.02em;">${esc(text)}</span>`
}

export const button = (text, url) => `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0 8px;">
	<tr>
		<td class="kh-button" bgcolor="${C.accent}" style="border-radius:10px;background:${C.accent};">
			<a href="${esc(url)}" target="_blank" style="display:inline-block;padding:14px 24px;border-radius:10px;color:#ffffff;font-family:${FONT};font-size:15px;font-weight:700;line-height:1;text-decoration:none;">${esc(text)}</a>
		</td>
	</tr>
</table>`

export const paragraph = (html, { muted = false, size = 15 } = {}) =>
	`<p class="${muted ? 'kh-muted' : 'kh-text2'}" style="margin:0 0 14px;color:${muted ? C.muted : C.text2};font-size:${size}px;line-height:1.6;">${html}</p>`

/** A small boxed note: grey, or amber for "wasn't you?" security notes. */
export const note = (html, { title = '', tone = 'gray' } = {}) => {
	const warm = tone === 'amber'
	return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:22px 0 0;">
	<tr>
		<td class="${warm ? 'kh-warn' : 'kh-soft'}" style="padding:14px 16px;border-radius:12px;background:${warm ? '#fff7e8' : C.soft};border:1px solid ${warm ? '#f3dcb0' : C.border};">
			${title ? `<div style="margin:0 0 4px;color:${warm ? '#7a4a00' : C.text};font-size:14px;font-weight:700;">${esc(title)}</div>` : ''}
			<div class="kh-muted" style="color:${warm ? '#7a4a00' : C.muted};font-size:13px;line-height:1.55;">${html}</div>
		</td>
	</tr>
</table>`
}

/** A card as it looks on the board: where it is, its title, and what changed. */
export const taskCard = ({ board, list, title, chips = [], quote = '' }) => `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 0;">
	<tr>
		<td class="kh-soft" style="padding:16px 18px;border-radius:14px;background:${C.soft};border:1px solid ${C.border};">
			<div class="kh-muted" style="color:${C.muted};font-size:12px;font-weight:600;letter-spacing:.01em;">${[board, list].filter(Boolean).map(esc).join(' &nbsp;·&nbsp; ')}</div>
			<div class="kh-text" style="margin:6px 0 0;color:${C.text};font-size:17px;font-weight:700;line-height:1.35;">${esc(title)}</div>
			${chips.length ? `<div style="margin:10px 0 0;">${chips.map(({ text, tone }) => label(text, tone)).join('&nbsp; ')}</div>` : ''}
			${quote ? `<div class="kh-quote" style="margin:12px 0 0;padding:10px 12px;border-left:3px solid ${C.accent};border-radius:0 8px 8px 0;background:${C.card};color:${C.text2};font-size:14px;line-height:1.55;">${esc(quote)}</div>` : ''}
		</td>
	</tr>
</table>`

const brand = `
<table role="presentation" cellspacing="0" cellpadding="0" border="0">
	<tr>
		<td width="30" height="30" align="center" valign="middle" bgcolor="${C.accent}" style="width:30px;height:30px;border-radius:9px;background:${C.accent};color:#ffffff;font-family:${FONT};font-size:16px;font-weight:800;line-height:30px;">K</td>
		<td style="padding-left:10px;font-family:${FONT};font-size:18px;font-weight:700;letter-spacing:-.01em;" class="kh-text"><span class="kh-text" style="color:${C.text};">Kanban</span><span style="color:${C.accent};">Hub</span></td>
	</tr>
</table>`

/**
 * The whole email. `content` is HTML made with the helpers above; `footer` lines are
 * plain HTML (already escaped); `fallbackUrl` adds the "button not working" link.
 */
export const renderEmail = ({ lang = 'en', title, preheader = '', eyebrow, eyebrowTone = 'accent', heading, intro = '', content = '', cta, after = '', fallbackLabel, footer = [] }) => `<!doctype html>
<html lang="${esc(lang)}" xmlns="http://www.w3.org/1999/xhtml">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<meta name="color-scheme" content="light dark">
	<meta name="supported-color-schemes" content="light dark">
	<meta name="x-apple-disable-message-reformatting">
	<title>${esc(title)}</title>
	<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
	<style>
		body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; }
		a { color: ${C.accent}; }
		@media (max-width: 620px) {
			.kh-pad { padding: 24px 20px !important; }
			.kh-h1 { font-size: 22px !important; }
		}
		@media (prefers-color-scheme: dark) {
			.kh-page { background: #0b1211 !important; }
			.kh-card { background: #121b1a !important; border-color: #24302e !important; }
			.kh-text, .kh-h1 { color: #e8f0ee !important; }
			.kh-text2 { color: #c3d0cd !important; }
			.kh-muted { color: #93a3a0 !important; }
			.kh-soft { background: #172221 !important; border-color: #24302e !important; }
			.kh-quote { background: #121b1a !important; color: #c3d0cd !important; }
			.kh-warn { background: #2a2111 !important; border-color: #4a3a1c !important; }
			.kh-rule { border-color: #24302e !important; }
		}
	</style>
</head>
<body class="kh-page" style="margin:0;padding:0;background:${C.page};font-family:${FONT};">
	<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">${esc(preheader)}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
	<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="kh-page" style="background:${C.page};">
		<tr>
			<td align="center" style="padding:32px 12px 40px;">
				<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;">
					<tr><td style="padding:0 4px 18px;">${brand}</td></tr>
					<tr>
						<td class="kh-card kh-pad" style="padding:32px 32px 30px;background:${C.card};border:1px solid ${C.border};border-radius:18px;font-family:${FONT};">
							${eyebrow ? `<div style="margin:0 0 14px;">${label(eyebrow, eyebrowTone)}</div>` : ''}
							<h1 class="kh-h1" style="margin:0 0 12px;color:${C.text};font-size:25px;font-weight:700;line-height:1.25;letter-spacing:-.02em;">${esc(heading)}</h1>
							${intro ? paragraph(intro) : ''}
							${content}
							${cta ? button(cta.label, cta.url) : ''}
							${after}
							${cta && fallbackLabel ? `<p class="kh-muted" style="margin:18px 0 0;color:${C.muted};font-size:12px;line-height:1.5;">${esc(fallbackLabel)}<br><a href="${esc(cta.url)}" style="color:${C.accent};word-break:break-all;">${esc(cta.url)}</a></p>` : ''}
						</td>
					</tr>
					<tr>
						<td class="kh-muted" style="padding:20px 8px 0;color:${C.muted};font-family:${FONT};font-size:12px;line-height:1.6;text-align:center;">
							${footer.map((line) => `<div style="margin:0 0 4px;">${line}</div>`).join('')}
							<div style="margin:10px 0 0;font-weight:700;">KanbanHub</div>
						</td>
					</tr>
				</table>
			</td>
		</tr>
	</table>
</body>
</html>`
