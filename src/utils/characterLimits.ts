/**
 * Limits for custom characters, shared by the editor and by import so the
 * two can never disagree. The backend keeps looser storage ceilings (it must
 * not truncate characters saved by older versions) but applies the same
 * reply-length clamp.
 */
export const LIMITS = {
	name: 32,
	description: 60,
	/** Above this, small models start to lose the thread. Warn, don't block. */
	promptSoft: 500,
	prompt: 2000,
	greeting: 140,
	starter: 80,
	starterCount: 4,
	maxTokensMin: 64,
	/** Half of the smallest model context (4096), leaving room for the prompt. */
	maxTokensMax: 2048,
} as const;
