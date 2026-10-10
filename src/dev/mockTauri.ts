/**
 * Browser preview backend (development only).
 *
 * `npm run dev` in a plain browser has no Tauri runtime, so every `invoke`
 * would throw. This module installs an in-memory stand-in for the Rust
 * commands so screens can be exercised without building the native app.
 * It is imported only when `import.meta.env.DEV` is true and no Tauri
 * runtime is present, so it never ships in a production bundle.
 *
 * State lives in localStorage under `neurix.mock`. Behaviour can be steered
 * from the console through `window.__neurixMock` (see `MockKnobs`).
 */
import type {
	ActiveModel,
	Backup,
	Character,
	Conversation,
	ConversationMeta,
	DownloadEvent,
	InferenceEvent,
	ModelInfo,
	Settings,
	StopReason,
} from "@/services/types";
import { mockIPC } from "@tauri-apps/api/mocks";

interface MockKnobs {
	/** Make the next `load_model` call reject. */
	failLoad: boolean;
	/** Make the next download fail its integrity check. */
	failVerify: boolean;
	/** Make conversation listing reject. */
	failHistory: boolean;
	/** Make settings writes reject. */
	failSettings: boolean;
	/** Force how the next reply ends. */
	stopReason: StopReason | null;
	/** Reported device RAM in GB (null = unknown). */
	ramGb: number | null;
	/** Milliseconds between streamed tokens. */
	tokenDelayMs: number;
	/** Simulated time spent reading the conversation before the first token. */
	promptDelayMs: number;
	/** How many times each command has been invoked. */
	calls: Record<string, number>;
	/** Arguments of the most recent `run_inference` call, for inspection. */
	lastInference: Record<string, unknown> | null;
	/** Wipe all mock data and reload. */
	reset: () => void;
}

interface MockState {
	settings: Settings;
	conversations: Record<string, Conversation>;
	installed: string[];
	partial: Record<string, number>;
}

const STORAGE_KEY = "neurix.mock";

interface MockModel {
	id: string;
	name: string;
	company: string;
	parameters: string;
	sizeMb: number;
	tag: string;
	description: string;
	best_for: string[];
	min_ram_gb: number;
	quality: number;
	speed: number;
	reasoning: ModelInfo["reasoning"];
	released?: string;
	legacy?: boolean;
}

const model = (m: MockModel): ModelInfo => ({
	id: m.id,
	name: m.name,
	description: m.description,
	size_bytes: m.sizeMb * 1_000_000,
	size_label: m.sizeMb >= 1000 ? `${(m.sizeMb / 1000).toFixed(1)} GB` : `${m.sizeMb} MB`,
	tag: m.tag,
	hf_repo: "mock/repo",
	hf_filename: "model.gguf",
	context_length: m.legacy ? 4096 : 8192,
	company: m.company,
	parameters: m.parameters,
	quantization: "Q4_K_M (4-bit)",
	best_for: m.best_for,
	min_ram_gb: m.min_ram_gb,
	quality: m.quality,
	speed: m.speed,
	reasoning: m.reasoning,
	released: m.released ?? "2026-02",
	legacy: m.legacy ?? false,
});

// Mirrors src-tauri/src/models/catalog.rs closely enough to exercise the UI.
const CATALOG: ModelInfo[] = [
	model({
		id: "qwen-3.5-0.8b",
		name: "Qwen 3.5 0.8B",
		company: "Alibaba",
		parameters: "0.8B",
		sizeMb: 640,
		tag: "Tiny",
		description:
			"The smallest model that still holds a real conversation. Starts instantly and runs on almost any phone.",
		best_for: ["Quick answers", "Older phones", "Many languages"],
		min_ram_gb: 3,
		quality: 2,
		speed: 5,
		reasoning: "optional",
	}),
	model({
		id: "lfm-2.5-1.2b",
		name: "LFM 2.5 1.2B",
		company: "Liquid AI",
		parameters: "1.2B",
		sizeMb: 840,
		tag: "Fast",
		description: "A model built specifically for phones. Very fast for its quality.",
		best_for: ["Fast replies", "Summaries", "Following instructions"],
		min_ram_gb: 3,
		quality: 2,
		speed: 5,
		reasoning: "none",
		released: "2026-01",
	}),
	model({
		id: "qwen-3.5-2b",
		name: "Qwen 3.5 2B",
		company: "Alibaba",
		parameters: "2B",
		sizeMb: 1300,
		tag: "Balanced",
		description:
			"The best all-rounder for most phones. Clear writing, solid general knowledge, and it can think a problem through when asked.",
		best_for: ["Everyday chat", "Writing help", "Many languages"],
		min_ram_gb: 4,
		quality: 3,
		speed: 4,
		reasoning: "optional",
	}),
	model({
		id: "lfm-2.5-2.6b",
		name: "LFM 2.5 2.6B",
		company: "Liquid AI",
		parameters: "2.6B",
		sizeMb: 1700,
		tag: "Balanced",
		description: "A reasoning model that works through a question step by step before it answers.",
		best_for: ["Step-by-step reasoning", "Maths and logic", "Planning"],
		min_ram_gb: 6,
		quality: 4,
		speed: 3,
		reasoning: "always",
		released: "2026-07",
	}),
	model({
		id: "qwen-3.5-4b",
		name: "Qwen 3.5 4B",
		company: "Alibaba",
		parameters: "4B",
		sizeMb: 2700,
		tag: "Smart",
		description:
			"The most capable model that fits a modern phone. Noticeably better at code, analysis and long answers.",
		best_for: ["Code", "Analysis", "Long, detailed answers"],
		min_ram_gb: 8,
		quality: 5,
		speed: 2,
		reasoning: "optional",
	}),
	model({
		id: "gemma-4-e2b",
		name: "Gemma 4 E2B",
		company: "Google",
		parameters: "2B effective",
		sizeMb: 3300,
		tag: "Smart",
		description: "An on-device model from Google. Natural, well-structured writing; a large download for how fast it runs.",
		best_for: ["Natural writing", "Explanations", "Creative work"],
		min_ram_gb: 8,
		quality: 4,
		speed: 3,
		reasoning: "optional",
		released: "2026-03",
	}),
	model({
		id: "gemma-4-e4b",
		name: "Gemma 4 E4B",
		company: "Google",
		parameters: "4B effective",
		sizeMb: 5200,
		tag: "Smart",
		description: "The larger Gemma 4. Needs a computer or a phone with 12 GB of memory or more.",
		best_for: ["Desktop use", "Hard questions", "Long documents"],
		min_ram_gb: 12,
		quality: 5,
		speed: 1,
		reasoning: "optional",
		released: "2026-03",
	}),
	model({
		id: "llama-3.2-3b",
		name: "Llama 3.2 3B",
		company: "Meta",
		parameters: "3B",
		sizeMb: 2000,
		tag: "Legacy",
		description:
			"Llama 3.2 3B is from an earlier Neurix catalog. It still works, but newer models of the same size give better answers.",
		best_for: ["Already installed"],
		min_ram_gb: 6,
		quality: 3,
		speed: 3,
		reasoning: "none",
		released: "2024-09",
		legacy: true,
	}),
];

const preset = (
	slug: string,
	name: string,
	description: string,
	icon: string,
	accent_color: string,
	greeting: string,
	conversation_starters: string[],
): Character => ({
	id: `preset:${slug}`,
	name,
	description,
	icon,
	accent_color,
	system_prompt: `Reply in a ${description.toLowerCase()} way.`,
	temperature: 0.7,
	top_p: 0.9,
	max_tokens: 512,
	conversation_starters,
	greeting,
	is_preset: true,
});

const PRESETS: Character[] = [
	preset("default", "Default", "Helpful and balanced", "smart_toy", "#8ff5ff", "Hi! What can I help you with?", [
		"Summarize a topic I'm trying to learn",
		"Help me draft a short message",
		"Explain something simply",
		"Brainstorm ideas with me",
	]),
	preset("friendly", "Friendly", "Warm and casual", "sentiment_satisfied", "#ffb86c", "Hey, good to see you! How's it going?", [
		"Cheer me up, I had a rough day",
		"Help me reply to a tricky text",
	]),
	preset("professional", "Professional", "Formal and precise", "business_center", "#65afff", "How can I assist you today?", [
		"Draft a polite follow-up email",
		"Outline a one-page proposal",
	]),
	preset("concise", "Concise", "Short and direct", "bolt", "#ffd95e", "Ask away.", ["Define a term in one line"]),
	preset("tutor", "Tutor", "Explains step by step", "school", "#c792ea", "What would you like to learn today?", [
		"Teach me something I'm curious about",
		"Quiz me on what I just learned",
	]),
	preset("creative", "Creative", "Playful and imaginative", "palette", "#ff79c6", "Let's make something interesting.", [
		"Write a tiny story from one prompt",
	]),
];

const DEFAULT_SETTINGS: Settings = {
	wifi_only: true,
	save_history: true,
	show_speed: true,
	system_prompt: "",
	temperature: 0.7,
	top_p: 0.9,
	max_tokens: 512,
	font_size: "medium",
	theme: "obsidian",
	onboarding_done: false,
	last_model_id: null,
	active_character_id: "preset:default",
	custom_characters: [],
};

function loadState(): MockState {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) return JSON.parse(raw) as MockState;
	} catch {
		// Fall through to a fresh state.
	}
	return { settings: { ...DEFAULT_SETTINGS }, conversations: {}, installed: [], partial: {} };
}

const state = loadState();
const persist = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

const knobs: MockKnobs = {
	failLoad: false,
	failVerify: false,
	failHistory: false,
	failSettings: false,
	stopReason: null,
	ramGb: 8,
	tokenDelayMs: 25,
	promptDelayMs: 0,
	calls: {},
	lastInference: null,
	reset: () => {
		localStorage.removeItem(STORAGE_KEY);
		location.reload();
	},
};

declare global {
	interface Window {
		__neurixMock?: MockKnobs;
	}
}
window.__neurixMock = knobs;

let activeModel: ActiveModel | null = null;
let inferenceCancelled = false;
const downloadCancels = new Map<string, { cancelled: boolean; discard: boolean }>();
let lastWrittenFile = "";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

interface Emitter<T> {
	onmessage: (message: T) => void;
}

const toMeta = (c: Conversation, snippet?: string): ConversationMeta => ({
	id: c.id,
	title: c.title,
	model_name: c.model_name,
	character_id: c.character_id,
	character_name: c.character_name,
	updated_at: c.updated_at,
	...(snippet ? { snippet } : {}),
});

const sortedMetas = (list: ConversationMeta[]) =>
	list.sort((a, b) => b.updated_at.localeCompare(a.updated_at));

function sampleReply(prompt: string): string {
	return [
		`Here is a **mock reply** to "${prompt.slice(0, 60)}".`,
		"",
		"## What this shows",
		"- Streaming, one word at a time",
		"- *Markdown* with `inline code` and a [link](https://example.com)",
		"  - a nested bullet",
		"",
		"> Offline models answer from what they learned, not from the web.",
		"",
		"| Setting | Value |",
		"|---|---|",
		"| user: | admin |",
		"| port | 5432 |",
		"",
		"```yaml",
		"db:",
		"  user: admin",
		"```",
		"",
		"1. First step",
		"2. Second step",
	].join("\n");
}

const SAMPLE_REASONING =
	"The user wants a short demonstration. I should show formatting: a heading, a list, a table and a code block. Keep it brief and end with numbered steps.";

const words = (text: string) => text.match(/\S+\s*/g) ?? [];

async function runInference(args: {
	prompt: string;
	maxTokens: number;
	history: unknown[];
	assistantPrefix: string | null;
	enableThinking: boolean;
	onEvent: Emitter<InferenceEvent>;
}): Promise<void> {
	const { onEvent: _channel, ...request } = args;
	knobs.lastInference = request;
	if (!activeModel) throw "No model loaded";
	inferenceCancelled = false;
	const emit = (e: InferenceEvent) => args.onEvent.onmessage(e);
	const full = args.assistantPrefix
		? " …and this is the continuation of the earlier reply, picking up where it stopped."
		: sampleReply(args.prompt);
	const pieces = words(full);
	const forced = knobs.stopReason;
	knobs.stopReason = null;
	const limit = forced === "length" ? Math.min(12, pieces.length) : pieces.length;
	let sent = 0;
	let reason: StopReason = forced ?? "eos";

	// Reading the conversation: only noticeable when a lot of it is new.
	const promptTokens = 60 + args.history.length * 180;
	const cachedTokens = args.history.length > 0 ? promptTokens - 90 : 0;
	const promptStarted = performance.now();
	if (knobs.promptDelayMs > 0) {
		for (let step = 1; step <= 5 && !inferenceCancelled; step++) {
			emit({ event: "PromptProgress", data: { processed: step * 256, total: 1280 } });
			await sleep(knobs.promptDelayMs / 5);
		}
	} else {
		await sleep(300);
	}
	const promptMs = Math.round(performance.now() - promptStarted);

	const thinks =
		!args.assistantPrefix &&
		(activeModel.reasoning === "always" || (activeModel.reasoning === "optional" && args.enableThinking));
	if (thinks) {
		for (const word of words(SAMPLE_REASONING)) {
			if (inferenceCancelled) break;
			emit({ event: "ReasoningGenerated", data: { token: word } });
			await sleep(knobs.tokenDelayMs);
		}
	}

	const started = performance.now();
	for (; sent < limit; sent++) {
		if (inferenceCancelled) {
			reason = "cancelled";
			break;
		}
		emit({
			event: "TokenGenerated",
			data: { token: pieces[sent], tokens_per_second: 1000 / Math.max(knobs.tokenDelayMs, 1) },
		});
		await sleep(knobs.tokenDelayMs);
	}
	emit({
		event: "GenerationComplete",
		data: {
			total_tokens: sent,
			duration_ms: Math.round(performance.now() - started),
			stop_reason: inferenceCancelled ? "cancelled" : reason,
			prompt_tokens: promptTokens,
			cached_tokens: cachedTokens,
			prompt_ms: promptMs,
		},
	});
}

async function downloadModel(args: { modelId: string; onEvent: Emitter<DownloadEvent> }): Promise<void> {
	const info = CATALOG.find((m) => m.id === args.modelId);
	if (!info) throw `Model ${args.modelId} not found in catalog`;
	const emit = (e: DownloadEvent) => args.onEvent.onmessage(e);
	const flags = { cancelled: false, discard: false };
	downloadCancels.set(info.id, flags);
	const total = info.size_bytes;
	let done = state.partial[info.id] ?? 0;
	const step = Math.ceil(total / 30);
	emit({ event: "Started", data: { total_bytes: total } });
	while (done < total) {
		await sleep(200);
		if (flags.cancelled) {
			downloadCancels.delete(info.id);
			if (flags.discard) delete state.partial[info.id];
			else state.partial[info.id] = done;
			persist();
			emit({ event: "Cancelled" });
			return;
		}
		done = Math.min(total, done + step);
		state.partial[info.id] = done;
		emit({ event: "Progress", data: { bytes_downloaded: done, total_bytes: total, speed_bps: step * 5 } });
	}
	downloadCancels.delete(info.id);
	emit({ event: "Verifying" });
	await sleep(400);
	if (knobs.failVerify) {
		knobs.failVerify = false;
		delete state.partial[info.id];
		persist();
		const error = "The downloaded file is corrupt (checksum mismatch). Please download it again.";
		emit({ event: "Failed", data: { error } });
		throw error;
	}
	delete state.partial[info.id];
	if (!state.installed.includes(info.id)) state.installed.push(info.id);
	persist();
	emit({ event: "Finished" });
}

type Args = Record<string, unknown>;

const handlers: Record<string, (args: Args) => unknown> = {
	get_model_catalog: () => CATALOG,
	get_preset_characters: () => PRESETS,
	get_downloaded_models: () =>
		CATALOG.filter((m) => state.installed.includes(m.id)).map((m) => ({
			id: m.id,
			name: m.name,
			size_bytes: m.size_bytes,
			size_label: m.size_label,
			tag: m.tag,
		})),
	get_partial_downloads: () =>
		CATALOG.filter((m) => state.partial[m.id] && !state.installed.includes(m.id)).map((m) => ({
			id: m.id,
			name: m.name,
			size_label: m.size_label,
			total_bytes: m.size_bytes,
			downloaded_bytes: state.partial[m.id],
		})),
	get_active_downloads: () => [...downloadCancels.keys()],
	download_model: (a) => downloadModel(a as never),
	cancel_download: (a) => {
		const id = a.modelId as string;
		const flags = downloadCancels.get(id);
		if (flags) {
			flags.cancelled = true;
			flags.discard = a.discard === true;
		} else if (a.discard === true) {
			delete state.partial[id];
			persist();
		}
	},
	delete_model: (a) => {
		const id = a.modelId as string;
		state.installed = state.installed.filter((m) => m !== id);
		delete state.partial[id];
		if (activeModel?.id === id) activeModel = null;
		persist();
	},
	load_model: async (a) => {
		const info = CATALOG.find((m) => m.id === a.modelId);
		if (!info) throw `Model ${String(a.modelId)} not found in catalog`;
		if (activeModel?.id === info.id) return;
		await sleep(900);
		if (knobs.failLoad) {
			knobs.failLoad = false;
			activeModel = null;
			throw "Failed to load weights: not enough memory";
		}
		activeModel = {
			id: info.id,
			name: info.name,
			reasoning: info.reasoning,
			context_length: state.settings.context_size || info.context_length,
			threads: state.settings.threads || 4,
		};
		state.settings.last_model_id = info.id;
		persist();
	},
	unload_model: () => {
		activeModel = null;
	},
	get_active_model: () => activeModel,
	run_inference: (a) => runInference(a as never),
	stop_inference: () => {
		inferenceCancelled = true;
	},
	benchmark_model: async () => {
		if (!activeModel) throw "No model loaded";
		await sleep(1800);
		return {
			prompt_tokens_per_second: 96.4,
			tokens_per_second: 14.2,
			prompt_tokens: 212,
			generated_tokens: 96,
			threads: activeModel.threads,
			context_length: activeModel.context_length,
		};
	},
	get_conversations: () => {
		if (knobs.failHistory) throw "Could not read the chats folder";
		return sortedMetas(Object.values(state.conversations).map((c) => toMeta(c)));
	},
	search_conversations: (a) => {
		const needle = String(a.query).trim().toLowerCase();
		const hits: ConversationMeta[] = [];
		for (const c of Object.values(state.conversations)) {
			const hit = c.messages.find((m) => m.content.toLowerCase().includes(needle));
			if (hit) {
				const at = hit.content.toLowerCase().indexOf(needle);
				hits.push(toMeta(c, `…${hit.content.slice(Math.max(0, at - 40), at + needle.length + 60)}…`));
			} else if (c.title.toLowerCase().includes(needle)) {
				hits.push(toMeta(c));
			}
		}
		return sortedMetas(hits);
	},
	load_conversation: (a) => state.conversations[a.id as string] ?? null,
	save_conversation: (a) => {
		const conv = a.conversation as Conversation;
		const existing = state.conversations[conv.id];
		state.conversations[conv.id] = { ...conv, created_at: existing?.created_at ?? conv.created_at };
		persist();
	},
	delete_conversation: (a) => {
		delete state.conversations[a.id as string];
		persist();
	},
	clear_all_conversations: () => {
		state.conversations = {};
		persist();
	},
	get_settings: () => state.settings,
	patch_settings: (a) => {
		if (knobs.failSettings) throw "Could not write settings";
		state.settings = { ...state.settings, ...(a.patch as Partial<Settings>) };
		persist();
		return state.settings;
	},
	reset_settings: () => {
		state.settings = {
			...DEFAULT_SETTINGS,
			last_model_id: state.settings.last_model_id,
			custom_characters: state.settings.custom_characters,
			onboarding_done: state.settings.onboarding_done,
		};
		persist();
		return state.settings;
	},
	get_storage_info: () => ({
		used_bytes: CATALOG.filter((m) => state.installed.includes(m.id)).reduce((n, m) => n + m.size_bytes, 0),
		models_count: state.installed.length,
		partial_bytes: Object.values(state.partial).reduce((n, b) => n + b, 0),
	}),
	check_available_space: () => true,
	get_available_space: () => 48 * 1024 ** 3,
	get_device_info: () => ({
		total_memory_bytes: knobs.ramGb === null ? null : knobs.ramGb * 1024 ** 3,
		inference_threads: 4,
	}),
	export_data: (): Backup => ({
		kind: "neurix.backup",
		version: 1,
		exported_at: new Date().toISOString(),
		custom_characters: state.settings.custom_characters ?? [],
		conversations: Object.values(state.conversations),
	}),
	import_data: (a) => {
		const backup = a.backup as Backup;
		if (backup?.kind !== "neurix.backup") throw "This file is not a Neurix backup.";
		for (const c of backup.conversations ?? []) state.conversations[c.id] = c;
		const incoming = backup.custom_characters ?? [];
		const ids = new Set(incoming.map((c) => c.id));
		state.settings.custom_characters = [
			...(state.settings.custom_characters ?? []).filter((c) => !ids.has(c.id)),
			...incoming,
		];
		persist();
		return { conversations: backup.conversations?.length ?? 0, characters: incoming.length };
	},
	"plugin:notification|is_permission_granted": () => true,
	"plugin:notification|request_permission": () => "granted",
	"plugin:dialog|save": () => "neurix-backup.json",
	"plugin:dialog|open": () => (lastWrittenFile ? "neurix-backup.json" : null),
	"plugin:fs|read_text_file": () => Array.from(new TextEncoder().encode(lastWrittenFile)),
};

mockIPC(async (cmd, payload) => {
	knobs.calls[cmd] = (knobs.calls[cmd] ?? 0) + 1;
	if (cmd === "plugin:fs|write_text_file") {
		lastWrittenFile = new TextDecoder().decode(payload as unknown as Uint8Array);
		return null;
	}
	const handler = handlers[cmd];
	if (handler) return handler((payload ?? {}) as Args);
	// Unhandled plugin calls (notifications, opener) are harmless no-ops here.
	if (cmd.startsWith("plugin:")) return null;
	throw `Mock backend: unknown command "${cmd}"`;
});
