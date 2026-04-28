import type { Character } from "@/services/types";

/**
 * Versioned wire format for shared characters.
 *
 * `kind` lets future imports reject other JSON we might add (e.g. shared
 * conversations). `version` lets the parser refuse formats from a future
 * release that we don't understand instead of silently dropping fields.
 */
export interface SharedCharacterEnvelope {
	kind: "neurix.character";
	version: 1;
	character: Omit<Character, "id" | "is_preset" | "created_at">;
}

export const SHARE_KIND = "neurix.character";
export const SHARE_VERSION = 1;

/**
 * Strip identity fields (id, is_preset, created_at) before sharing. The
 * recipient should always end up with a fresh local id and `is_preset:
 * false`, regardless of where the character came from.
 */
export function toSharePayload(c: Character): SharedCharacterEnvelope {
	const { id: _id, is_preset: _isPreset, created_at: _createdAt, ...rest } = c;
	return {
		kind: SHARE_KIND,
		version: SHARE_VERSION,
		character: rest,
	};
}

export function serializeShared(c: Character): string {
	return JSON.stringify(toSharePayload(c), null, 2);
}

/* ── Validation helpers ── */

const isString = (v: unknown): v is string => typeof v === "string";
const isNumberInRange = (v: unknown, lo: number, hi: number): v is number =>
	typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi;

/**
 * Parse and validate a shared-character payload. Returns either a
 * usable Character draft (no id, no created_at — the caller assigns
 * those) or an `ImportError` describing what went wrong.
 *
 * Validation is strict on the wire-format header (`kind`, `version`)
 * and on required fields, lenient on optional ones (defaults applied).
 */
export type ParseResult =
	| { ok: true; draft: Omit<Character, "id" | "created_at"> }
	| { ok: false; error: string };

export function parseShared(input: string): ParseResult {
	let parsed: unknown;
	try {
		parsed = JSON.parse(input.trim());
	} catch {
		return { ok: false, error: "That doesn't look like JSON." };
	}
	if (!parsed || typeof parsed !== "object") {
		return { ok: false, error: "Invalid character file." };
	}
	const env = parsed as Partial<SharedCharacterEnvelope>;
	if (env.kind !== SHARE_KIND) {
		return { ok: false, error: "Not a Neurix character." };
	}
	if (env.version !== SHARE_VERSION) {
		return {
			ok: false,
			error: `Unsupported version (${env.version}). Update Neurix to import.`,
		};
	}
	const c = env.character as Partial<Character> | undefined;
	if (!c) return { ok: false, error: "Missing character data." };

	if (!isString(c.name) || c.name.trim().length === 0) {
		return { ok: false, error: "Character is missing a name." };
	}
	if (!isString(c.system_prompt) || c.system_prompt.trim().length === 0) {
		return { ok: false, error: "Character is missing instructions." };
	}
	if (!isString(c.icon)) {
		return { ok: false, error: "Character is missing an icon." };
	}
	if (!isNumberInRange(c.temperature, 0, 2)) {
		return { ok: false, error: "Invalid temperature value." };
	}
	if (!isNumberInRange(c.top_p, 0, 1)) {
		return { ok: false, error: "Invalid top-p value." };
	}
	if (!isNumberInRange(c.max_tokens, 16, 8192)) {
		return { ok: false, error: "Invalid max tokens value." };
	}

	const draft: Omit<Character, "id" | "created_at"> = {
		name: c.name.trim().slice(0, 64),
		description: isString(c.description) ? c.description.trim().slice(0, 120) : "",
		icon: c.icon,
		accent_color:
			isString(c.accent_color) && /^#[0-9a-fA-F]{6}$/.test(c.accent_color)
				? c.accent_color
				: undefined,
		system_prompt: c.system_prompt.trim().slice(0, 4000),
		temperature: c.temperature,
		top_p: c.top_p,
		max_tokens: Math.round(c.max_tokens),
		conversation_starters:
			Array.isArray(c.conversation_starters)
				? c.conversation_starters
						.filter(isString)
						.map((s) => s.trim())
						.filter((s) => s.length > 0)
						.slice(0, 4)
				: undefined,
		greeting:
			isString(c.greeting) && c.greeting.trim().length > 0
				? c.greeting.trim().slice(0, 200)
				: undefined,
		// Imported characters are always custom on the recipient's side,
		// even if the source happened to be a preset. We strip is_preset on
		// export, but defend in depth here.
		is_preset: false,
	};
	return { ok: true, draft };
}

/**
 * Try the platform share sheet first (Android, iOS, modern desktop), fall
 * back to clipboard. Returns which path was taken so the caller can
 * surface the right toast.
 */
export async function shareCharacter(
	character: Character,
): Promise<"shared" | "copied"> {
	const json = serializeShared(character);
	const title = `Neurix character: ${character.name}`;

	if (typeof navigator.share === "function") {
		try {
			await navigator.share({ title, text: json });
			return "shared";
		} catch (err) {
			// User cancellation throws AbortError — silently fall through to
			// clipboard so we don't double-toast on cancel.
			if (err instanceof Error && err.name === "AbortError") {
				throw err;
			}
		}
	}
	await navigator.clipboard.writeText(json);
	return "copied";
}
