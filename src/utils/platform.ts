/** True on phones and tablets (Android, iOS). Desktop WebViews return false. */
export function isMobile(): boolean {
	return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/** True when the primary input is touch (no hover, coarse pointer). */
export function isTouchPrimary(): boolean {
	return window.matchMedia("(hover: none) and (pointer: coarse)").matches;
}

export function vibrate(pattern: number | number[]): void {
	if (navigator.vibrate) navigator.vibrate(pattern);
}

/**
 * Copy text to the clipboard. Resolves with whether it actually worked, so
 * callers only show "Copied" when it did.
 */
export async function copyText(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		return false;
	}
}
