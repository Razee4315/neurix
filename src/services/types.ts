export interface ModelInfo {
	id: string;
	name: string;
	description: string;
	size_bytes: number;
	size_label: string;
	tag: string;
	hf_repo: string;
	hf_filename: string;
	tokenizer_repo: string;
	chat_template: ChatTemplate;
	context_length: number;
	company: string;
	parameters: string;
	quantization: string;
	best_for: string[];
}

export type ChatTemplate = "Llama3" | "SmolLM" | "Gemma" | "Phi3" | "Qwen";

export type DownloadEvent =
	| { event: "Started"; data: { total_bytes: number } }
	| {
			event: "Progress";
			data: { bytes_downloaded: number; total_bytes: number; speed_bps: number };
	  }
	| { event: "Verifying" }
	| { event: "Finished" }
	| { event: "Failed"; data: { error: string } }
	| { event: "Cancelled" };

export interface DownloadedModel {
	id: string;
	name: string;
	size_bytes: number;
	size_label: string;
	tag: string;
}

/** A download interrupted in an earlier session and still on disk. */
export interface PartialDownload {
	id: string;
	name: string;
	size_label: string;
	total_bytes: number;
	downloaded_bytes: number;
}

/** The model currently selected for chat. */
export interface ActiveModel {
	id: string;
	name: string;
}

/** Why the backend stopped generating. */
export type StopReason =
	| "eos"
	| "length"
	| "cancelled"
	| "stop_sequence"
	| "repetition"
	| "low_confidence";

export type InferenceEvent =
	| { event: "TokenGenerated"; data: { token: string; tokens_per_second: number } }
	| {
			event: "GenerationComplete";
			data: { total_tokens: number; duration_ms: number; stop_reason: StopReason };
	  }
	| { event: "ContextTrimmed"; data: { pairs_dropped: number } }
	| { event: "Error"; data: { message: string } };

export interface Character {
	/** "preset:<slug>" for built-ins, "custom:<uuid>" for user-created. */
	id: string;
	name: string;
	description: string;
	/** Icon name from the app's icon set (e.g. "auto_awesome"). */
	icon: string;
	/**
	 * Hex color used to tint the character's icon bubble and chip.
	 * Optional — falls back to `tokens.colors.primary` for legacy/missing data.
	 */
	accent_color?: string;
	system_prompt: string;
	temperature: number;
	top_p: number;
	max_tokens: number;
	/**
	 * Tappable example prompts shown on the empty-chat state. Each entry is a
	 * single-line string, kept short (≤80 chars). Up to 4 are surfaced.
	 */
	conversation_starters?: string[];
	/**
	 * Optional opening line shown as the first AI bubble on a fresh chat.
	 * Pure UI — never sent to inference, so it doesn't pollute context.
	 */
	greeting?: string;
	is_preset: boolean;
	created_at?: string;
	/**
	 * ISO timestamp of the most recent time the user selected this character
	 * as active. Used by the picker to surface recently-used customs near the
	 * top. Optional — missing values sort to the bottom.
	 */
	last_used_at?: string;
}

export interface Settings {
	wifi_only: boolean;
	save_history: boolean;
	show_speed: boolean;
	/**
	 * Legacy free-form system prompt. Kept for read-only migration to a
	 * custom character on first run after the character feature lands.
	 */
	system_prompt: string;
	temperature: number;
	top_p: number;
	max_tokens: number;
	font_size?: string;
	/** Id of the color theme (see theme/themes.ts). */
	theme?: string;
	/** True once the first-run walkthrough has been finished or skipped. */
	onboarding_done?: boolean;
	last_model_id?: string | null;
	/** ID of the character used when starting a new chat. */
	active_character_id?: string;
	/** User-created characters. Presets live in the Rust side and are not stored here. */
	custom_characters?: Character[];
}

export interface StorageInfo {
	used_bytes: number;
	models_count: number;
	/** Bytes held by unfinished downloads. */
	partial_bytes: number;
}

export interface DeviceInfo {
	/** Physical RAM in bytes, or null when the platform does not report it. */
	total_memory_bytes: number | null;
}

/** Portable copy of the user's chats and custom characters. */
export interface Backup {
	kind: "neurix.backup";
	version: 1;
	exported_at: string;
	custom_characters: Character[];
	conversations: Conversation[];
}

export interface ImportSummary {
	conversations: number;
	characters: number;
}

export interface Conversation {
	id: string;
	title: string;
	model_id: string;
	model_name: string;
	/**
	 * The character active when this conversation was last saved. Used by the
	 * history page to filter "show only chats with X". Optional for back-compat
	 * with conversations saved before the field existed.
	 */
	character_id?: string;
	character_name?: string;
	created_at: string;
	updated_at: string;
	messages: ChatMessage[];
}

export interface ChatMessage {
	role: "user" | "assistant";
	content: string;
	timestamp: string;
}

export interface ConversationMeta {
	id: string;
	title: string;
	model_name: string;
	character_id?: string;
	character_name?: string;
	updated_at: string;
	/** Excerpt around a search hit inside a message (search results only). */
	snippet?: string;
}
