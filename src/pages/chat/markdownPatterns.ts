/**
 * Patterns for the chat markdown renderer, kept apart from the component so
 * they can be tested.
 *
 * Text reaching these comes from the model and from imported backups, so
 * every quantifier is bounded: an unbounded one makes a long line of `[` or
 * spaces take quadratic time and freeze the UI.
 */

/** Lines longer than this render as plain text. */
export const MAX_INLINE_LINE = 8000;

/** Bold, italic, inline code and https links, in that order of groups. */
export const INLINE =
	/(\*\*(.{1,500}?)\*\*|\*(.{1,500}?)\*|`([^`\n]{1,2000})`|\[([^\]\n]{1,200})\]\((https?:\/\/[^\s)]{1,2048})\))/g;

/** Longest line that can still be a table divider. */
const MAX_DIVIDER_LINE = 1000;

export const isTableDivider = (line: string | undefined) =>
	line !== undefined &&
	line.length <= MAX_DIVIDER_LINE &&
	/^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);
