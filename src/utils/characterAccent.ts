import type { Character } from "@/services/types";
import { tokens } from "@/theme/tokens";

/**
 * Curated palette for custom characters. Each entry has:
 *  - `value`: the hex stored on the character
 *  - `label`: a short name surfaced to assistive tech
 *
 * Colors are picked to read against `surfaceContainerHigh` in dark mode and
 * to remain visually distinct from each other at a glance in the picker.
 */
export const ACCENT_PALETTE: ReadonlyArray<{ value: string; label: string }> = [
	{ value: "#8ff5ff", label: "Electric blue" },
	{ value: "#65afff", label: "Sky blue" },
	{ value: "#c792ea", label: "Lavender" },
	{ value: "#ff79c6", label: "Pink" },
	{ value: "#ffb86c", label: "Amber" },
	{ value: "#2ff801", label: "Cyber green" },
	{ value: "#ff716c", label: "Coral" },
	{ value: "#adaaab", label: "Slate" },
];

export const DEFAULT_ACCENT = ACCENT_PALETTE[0].value;

/**
 * Resolve a character's accent, falling back to the theme primary.
 *
 * The palette is tuned for dark surfaces. On light themes the same hues are
 * darkened so icons and labels keep enough contrast against pale backgrounds.
 */
export function accentOf(character: Character | null | undefined): string {
	const c = character?.accent_color;
	if (!c || !/^#[0-9a-fA-F]{6}$/.test(c)) return tokens.colors.primary;
	if (c.toLowerCase() === DEFAULT_ACCENT) return tokens.colors.primary;
	if (document.documentElement.dataset.mode === "light") {
		return `color-mix(in srgb, ${c} 58%, black)`;
	}
	return c;
}
