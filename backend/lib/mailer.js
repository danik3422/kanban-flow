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
