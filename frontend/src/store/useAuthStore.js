import create from 'zustand'

export const useAuthStore = create((set) => ({
	authUser: null,
	isSigningIn: false,
	isSigningUp: false,
	isCheckingAuth: false,
}))
