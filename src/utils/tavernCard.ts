import type { Character } from "@/services/types";
import { LIMITS } from "./characterLimits";
import { type ParseResult, parseShared, SHARE_KIND, SHARE_VERSION, toSharePayload } from "./characterShare";

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

function pngCardText(bytes: Uint8Array): string {
	if (!PNG_SIGNATURE.every((byte, i) => bytes[i] === byte)) {
		throw new Error("This file is not a PNG image.");
	}
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	for (let offset = PNG_SIGNATURE.length; offset + 12 <= bytes.length; ) {
		const size = view.getUint32(offset);
		const type = view.getUint32(offset + 4);
		const start = offset + 8;
		const end = start + size;
		if (end + 4 > bytes.length) throw new Error("The PNG contains an incomplete chunk.");
		if (type === 0x49454e44) break; // IEND
		// PNG tEXt stores a NUL-delimited keyword followed by the text payload.
		if (
			type === 0x74455874 &&
			size >= 6 &&
			[99, 104, 97, 114, 97, 0].every((byte, i) => bytes[start + i] === byte)
		) {
			try {
				const base64 = new TextDecoder().decode(bytes.subarray(start + 6, end));
				const decoded = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
				return new TextDecoder("utf-8", { fatal: true }).decode(decoded);
			} catch {
				throw new Error("The PNG's character card contains invalid encoded text.");
			}
		}
		offset = end + 4;
	}
	throw new Error("This PNG does not contain a Tavern character card.");
}

function record(value: unknown): Record<string, unknown> | undefined {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;
}

const field = (value: unknown) => typeof value === "string" ? value.trim() : "";
const starter = (value: unknown) => field(value).replace(/\s+/g, " ");
const boundedNumber = (value: unknown, min: number, max: number, fallback: number) =>
	typeof value === "number" && value >= min && value <= max ? value : fallback;

export function parseTavernCard(input: string | Uint8Array): ParseResult {
	let raw: string;
	try {
		raw = typeof input === "string" ? input : pngCardText(input);
	} catch (err) {
		return { ok: false, error: err instanceof Error ? err.message : "Couldn't read the PNG card." };
	}
	let value: unknown;
	try {
		value = JSON.parse(raw.trim());
	} catch {
		return { ok: false, error: "The card contains invalid JSON." };
	}
	const envelope = record(value);
	const data = envelope?.spec === "chara_card_v2"
		? record(envelope.data)
		: envelope?.spec === undefined ? envelope : undefined;
	const name = field(data?.name);
	if (!data || !name) {
		return { ok: false, error: "Choose a Tavern V1 or V2 card with a character name." };
	}
	const description = field(data.description);
	const neurix = record(record(data.extensions)?.neurix);
	const instructions = [
		data.system_prompt,
		description,
		data.personality,
		data.scenario,
		data.mes_example,
		data.post_history_instructions,
	].map(field).filter(Boolean).join("\n\n");
	if (!envelope?.spec && !instructions && typeof data.first_mes !== "string") {
		return { ok: false, error: "This JSON is missing the fields of a Tavern V1 card." };
	}
	// Reuse the native character validation, limits and defaults for both editors.
	return parseShared(JSON.stringify({
		kind: SHARE_KIND,
		version: SHARE_VERSION,
		character: {
			name,
			description: field(neurix?.description) || description.replace(/\s+/g, " "),
			system_prompt: field(neurix?.instructions) || instructions || `Speak as ${name}.`,
			greeting: field(data.first_mes),
			conversation_starters: Array.isArray(neurix?.starters) ? neurix.starters.map(starter) : [],
			icon: typeof neurix?.icon === "string" ? neurix.icon : "person",
			accent_color: neurix?.accent_color,
			temperature: boundedNumber(neurix?.temperature, 0, 2, 0.7),
			top_p: boundedNumber(neurix?.top_p, 0, 1, 0.9),
			max_tokens: boundedNumber(neurix?.max_tokens, LIMITS.maxTokensMin, 8192, 512),
			persona: record(neurix?.persona),
		},
	}));
}

export function serializeTavernCard(character: Character): string {
	const card = toSharePayload(character).character;
	return JSON.stringify({
		spec: "chara_card_v2",
		spec_version: "2.0",
		data: {
			name: card.name,
			description: card.description,
			personality: "",
			scenario: "",
			first_mes: card.greeting ?? "",
			mes_example: "",
			creator_notes: "",
			system_prompt: card.system_prompt,
			post_history_instructions: "",
			alternate_greetings: [],
			tags: [],
			creator: "",
			character_version: "",
			extensions: {
				neurix: {
					description: card.description,
					instructions: card.system_prompt,
					icon: card.icon,
					accent_color: card.accent_color,
					temperature: card.temperature,
					top_p: card.top_p,
					max_tokens: card.max_tokens,
					starters: card.conversation_starters,
					persona: card.persona,
				},
			},
		},
	}, null, 2);
}
