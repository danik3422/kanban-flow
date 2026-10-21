import { create } from 'zustand'
import { axiosInstance } from './axios'

// What the API server offers (GET /api/config), so one build of the web app fits the
// hosted version and self-hosted servers with or without email and internet photos.
// Remembered on the device, so it is right from the first frame and offline.
const STORAGE_KEY = 'kanban-server-config'
const DEFAULTS = { email: true, emailVerification: true, photos: true, selfHosted: false, signup: true }

const remembered = () => {
	try {
		return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }
	} catch {
		return DEFAULTS
	}
}

export const useServerConfig = create(() => remembered())

export const loadServerConfig = async () => {
	try {
		const { data } = await axiosInstance.get('/config', { cache: false })
		const next = { ...DEFAULTS, ...data }
		useServerConfig.setState(next)
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
		} catch {
			// storage blocked: the defaults hold for this visit
		}
	} catch {
		// Offline or an older server: keep what was remembered.
	}
}

// Passkeys need a secure page (https or localhost); a home server on plain http can't use them.
export const passkeysAvailable = () => typeof window !== 'undefined' && Boolean(window.PublicKeyCredential) && window.isSecureContext
