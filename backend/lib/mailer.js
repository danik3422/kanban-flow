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

export const sendPasswordResetEmail = async ({ email, resetUrl }) => {
	const transporter = getTransporter()
	if (!transporter) {
		throw new Error('SMTP is not configured')
	}

	await transporter.sendMail({
		from: env.mailFrom || env.smtp.user,
		to: email,
		subject: 'Reset your Kanban password',
		text: `Reset your Kanban password by opening this link: ${resetUrl}`,
		html: `
			<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #202c35">
				<h2>Reset your Kanban password</h2>
				<p>This link is valid for ${env.passwordResetMinutes} minutes.</p>
				<p><a href="${resetUrl}">Choose a new password</a></p>
				<p>If you did not request this, you can ignore this email.</p>
			</div>
		`,
	})
}

export const sendAccountVerificationEmail = async ({ email, verificationUrl }) => {
	const transporter = getTransporter()
	if (!transporter) {
		throw new Error('SMTP is not configured')
	}

	await transporter.sendMail({
		from: env.mailFrom || env.smtp.user,
		to: email,
		subject: 'Verify your KanbanHub account',
		text: `Verify your KanbanHub account by opening this link: ${verificationUrl}`,
		html: `
			<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #202c35; max-width: 600px; margin: 0 auto; padding: 24px;">
				<div style="font-size: 28px; font-weight: 700; margin-bottom: 16px; color: #111827;">KanbanHub</div>
				<h2 style="margin: 0 0 12px;">Verify your account</h2>
				<p>Thanks for signing up. Please verify your email address to activate your account.</p>
				<p><a href="${verificationUrl}">Verify my account</a></p>
				<p>This link is valid for ${env.emailVerificationMinutes} minutes.</p>
				<p>If you did not create this account, you can ignore this email.</p>
			</div>
		`,
	})
}

export const sendBoardInviteEmail = async ({ email, boardName, boardUrl }) => {
	const transporter = getTransporter()
	if (!transporter) {
		throw new Error('SMTP is not configured')
	}

	await transporter.sendMail({
		from: env.mailFrom || env.smtp.user,
		to: email,
		subject: `You were invited to ${boardName}`,
		text: `You were invited to collaborate on ${boardName}. Open the board here: ${boardUrl}`,
		html: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #202c35"><h2>You were invited to collaborate</h2><p>You have access to <strong>${boardName}</strong>.</p><p><a href="${boardUrl}">Open the workspace</a></p></div>`,
	})
}
