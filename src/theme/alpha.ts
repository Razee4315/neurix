/**
 * Apply an alpha channel to a color.
 *
 * Theme colors are CSS variables (`rgb(var(--c-primary))`), so the old
 * "append two hex digits" trick no longer works for them. This helper accepts
 * the same two-digit hex alpha the codebase already uses and handles theme
 * tokens, plain `#rrggbb` values (character accents), and anything else.
 */
export function alpha(color: string, hexAlpha: string): string {
	const opacity = Math.round((Number.parseInt(hexAlpha, 16) / 255) * 1000) / 1000;
	const themed = color.match(/^rgb\(var\((--c-[\w-]+)\)\)$/);
	if (themed) return `rgb(var(${themed[1]}) / ${opacity})`;
	if (/^#[0-9a-fA-F]{6}$/.test(color)) return `${color}${hexAlpha}`;
	return `color-mix(in srgb, ${color} ${Math.round(opacity * 100)}%, transparent)`;
}
