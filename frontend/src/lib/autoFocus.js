// On touch screens focusing a text field pops up the keyboard, which covers a bottom
// sheet and can push the layout around. There, fields wait for a tap instead.

const TEXT_ENTRY = 'input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=range]):not([type=file]):not([type=color]), textarea, select, [contenteditable="true"]'

export const isTouchScreen = () =>
	typeof window !== 'undefined' && (window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(max-width: 720px)').matches)

export const isTextEntry = (element) => element instanceof Element && element.matches(TEXT_ENTRY)

/** For `autoFocus` on fields that appear by themselves (not after a tap meant for typing). */
export const canAutoFocusTyping = () => !isTouchScreen()
