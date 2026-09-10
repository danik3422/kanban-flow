import nodemailer from 'nodemailer'

import { env } from '../config/env.js'

const getTransporter = () => {
	if (!env.smtp.host || !env.smtp.user || !env.smtp.password) {
		return null
	}

	return nodemailer.createTransport({
		host: env.smtp.host,
		port: env.smtp.port,
		secure: env.smtp.secure,
		auth: {
			user: env.smtp.user,
			pass: env.smtp.password,
		},
	})
}

const escapeHtml = (value = '') =>
	String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#039;')

const getRecipient = (email) => env.mailRedirectTo || email

const renderEmail = ({ eyebrow, title, intro, body, ctaLabel, ctaUrl, note, preheader }) => `
<!doctype html>
<html lang="en">
	<body style="margin:0;background:#f2f7f4;color:#202c35;font-family:Arial,Helvetica,sans-serif;line-height:1.5;">
		<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
		<div style="padding:32px 16px;">
			<div style="width:100%;max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #dce8e0;border-radius:18px;overflow:hidden;box-shadow:0 14px 34px rgba(31,67,51,.10);">
				<div style="height:6px;background:#147d78;"></div>
				<div style="padding:30px 32px 32px;">
					<div style="font-size:21px;font-weight:700;letter-spacing:-.02em;color:#202c35;">Kanban<span style="color:#147d78;">Hub</span></div>
					<div style="margin-top:28px;color:#147d78;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;">${escapeHtml(eyebrow)}</div>
					<h1 style="margin:8px 0 12px;color:#202c35;font-size:28px;line-height:1.15;letter-spacing:-.03em;">${escapeHtml(title)}</h1>
					<p style="margin:0 0 20px;color:#687875;font-size:15px;">${escapeHtml(intro)}</p>
					<div style="color:#4d5e59;font-size:15px;">${body}</div>
					<div style="margin:26px 0 22px;">
						<a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:13px 19px;border-radius:9px;background:#147d78;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">${escapeHtml(ctaLabel)} &rarr;</a>
					</div>
					<div style="padding:13px 15px;border:1px solid #e1ebe4;border-radius:10px;background:#f7faf8;color:#7b8984;font-size:12px;">${note}</div>
					<p style="margin:18px 0 0;color:#8a9892;font-size:11px;line-height:1.5;">Button not working? Copy this link into your browser:<br><a href="${escapeHtml(ctaUrl)}" style="color:#147d78;word-break:break-all;">${escapeHtml(ctaUrl)}</a></p>
				</div>
				<div style="padding:18px 32px;border-top:1px solid #edf2ee;color:#8a9892;font-size:11px;">You received this message from KanbanHub. Please do not reply to this automated email.</div>
			</div>
		</div>
	</body>
</html>`

const getMailOptions = ({ email, subject, text, html }) => ({
	from: env.mailFrom || env.smtp.user,
	to: getRecipient(email),
	subject,
	text,
	html,
	...(env.mailReplyTo ? { replyTo: env.mailReplyTo } : {}),
})

export const sendPasswordResetEmail = async ({ email, resetUrl }) => {
	const transporter = getTransporter()
	if (!transporter) {
		throw new Error('SMTP is not configured')
	}

	await transporter.sendMail(getMailOptions({
		email,
		subject: 'Reset your Kanban password',
		text: `Reset your Kanban password by opening this link: ${resetUrl}`,
		html: renderEmail({
			preheader: `Reset your password in ${env.passwordResetMinutes} minutes.`,
			eyebrow: 'Account security',
			title: 'Reset your password',
			intro: 'Choose a new password and get back to your workspace.',
			body: 'This secure link expires in <strong>' + escapeHtml(env.passwordResetMinutes) + ' minutes</strong>.',
			ctaLabel: 'Choose a new password',
			ctaUrl: resetUrl,
			note: 'If you did not request a password reset, no action is needed. Your account remains safe.',
		}),
	}))
}

export const sendPasswordAddedEmail = async ({ email, settingsUrl }) => {
	const transporter = getTransporter()
	if (!transporter) {
		throw new Error('SMTP is not configured')
	}

	await transporter.sendMail(getMailOptions({
		email,
		subject: 'A password sign-in method was added to your KanbanHub account',
		text: `A password sign-in method was added to your KanbanHub account. If this was not you, review your account security: ${settingsUrl}`,
		html: renderEmail({
			preheader: 'A password sign-in method was added to your account.',
			eyebrow: 'Account security',
			title: 'Password sign-in added',
			intro: 'A password was added to your KanbanHub account.',
			body: 'You can now sign in with your email address and password, as well as with your connected provider.',
			ctaLabel: 'Review account security',
			ctaUrl: settingsUrl,
			note: 'If you did not make this change, sign in with your provider and change the password immediately.',
		}),
	}))
}

export const sendAccountVerificationEmail = async ({ email, verificationUrl }) => {
	const transporter = getTransporter()
	if (!transporter) {
		throw new Error('SMTP is not configured')
	}

	await transporter.sendMail(getMailOptions({
		email,
		subject: 'Verify your KanbanHub account',
		text: `Verify your KanbanHub account by opening this link: ${verificationUrl}`,
		html: renderEmail({
			preheader: 'Confirm your email address to activate your KanbanHub account.',
			eyebrow: 'Welcome to KanbanHub',
			title: 'Verify your account',
			intro: 'One quick step and your workspace is ready.',
			body: 'Confirm your email address to activate your KanbanHub account. This link expires in <strong>' + escapeHtml(env.emailVerificationMinutes) + ' minutes</strong>.',
			ctaLabel: 'Verify my account',
			ctaUrl: verificationUrl,
			note: 'If you did not create this account, you can safely ignore this email.',
		}),
	}))
}

export const sendBoardInviteEmail = async ({ email, boardName, boardUrl }) => {
	const transporter = getTransporter()
	if (!transporter) {
		throw new Error('SMTP is not configured')
	}

	await transporter.sendMail(getMailOptions({
		email,
		subject: `You were invited to ${boardName}`,
		text: `You were invited to collaborate on ${boardName}. Open the board here: ${boardUrl}`,
		html: renderEmail({
			preheader: `You have been invited to collaborate on ${boardName}.`,
			eyebrow: 'Workspace invitation',
			title: 'You are invited to collaborate',
			intro: `You have been invited to join ${boardName}.`,
			body: 'Open the room to see the board, meet the team, and start making progress together.',
			ctaLabel: 'Open the workspace',
			ctaUrl: boardUrl,
			note: 'This invitation may expire or be revoked by the room owner.',
		}),
	}))
}
