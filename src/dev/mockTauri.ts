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
	/** Make the next download fail at the tokenizer step. */
	failTokenizer: boolean;
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

const model = (
	id: string,
	name: string,
	sizeMb: number,
	tag: string,
	company: string,
	chat_template: ModelInfo["chat_template"],
	best_for: string[],
): ModelInfo => ({
	id,
	name,
	description: `${company}'s ${name}. A compact model that runs entirely on this device.`,
	size_bytes: sizeMb * 1_000_000,
	size_label: sizeMb >= 1000 ? `~${(sizeMb / 1000).toFixed(1)} GB` : `~${sizeMb} MB`,
	tag,
	hf_repo: "mock/repo",
	hf_filename: "model.gguf",
	tokenizer_repo: "mock/repo",
	chat_template,
	context_length: 4096,
	company,
	parameters: name.split(" ").pop() ?? "",
	quantization: "Q4_K_M (4-bit)",
	best_for,
});

const CATALOG: ModelInfo[] = [
	model("llama-3.2-1b", "Llama 3.2 1B", 700, "Tiny", "Meta", "Llama3", ["Quick chat", "Simple Q&A", "Low-end devices"]),
	model("smollm2-1.7b", "SmolLM2 1.7B", 1000, "Popular", "HuggingFace", "SmolLM", ["General chat", "Summarization"]),
	model("gemma-2-2b", "Gemma 2 2B", 1500, "Fast", "Google", "Gemma", ["On-device AI", "General tasks"]),
	model("llama-3.2-3b", "Llama 3.2 3B", 2000, "Popular", "Meta", "Llama3", ["Chat & reasoning", "Creative writing"]),
	model("phi-3.5-mini", "Phi-3.5 Mini", 2200, "Code", "Microsoft", "Phi3", ["Code generation", "Debugging"]),
	model("qwen-2.5-0.5b", "Qwen 2.5 0.5B", 380, "Tiny", "Alibaba", "Qwen", ["Ultra-fast", "Basic tasks"]),
	model("qwen-2.5-1.5b", "Qwen 2.5 1.5B", 940, "Popular", "Alibaba", "Qwen", ["Multilingual", "Reasoning"]),
	model("qwen-2.5-3b", "Qwen 2.5 3B", 1800, "Popular", "Alibaba", "Qwen", ["Complex tasks", "Multilingual"]),
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
	preset("default", "Default", "Helpful and balanced", "auto_awesome", "#8ff5ff", "Hi! What can I help you with?", [
		"Summarize a topic I'm trying to learn",
		"Help me draft a short message",
		"Explain something simply",
		"Brainstorm ideas with me",
	]),
	preset("friendly", "Friendly", "Warm and casual", "sentiment_satisfied", "#ffb86c", "Hey, good to see you! How's it going?", [
		"Cheer me up — I had a rough day",
		"Help me reply to a tricky text",
	]),
	preset("professional", "Professional", "Formal and precise", "business_center", "#65afff", "How can I assist you today?", [
		"Draft a polite follow-up email",
		"Outline a one-page proposal",
	]),
	preset("concise", "Concise", "Short and direct", "bolt", "#2ff801", "Ask away.", ["Define a term in one line"]),
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
	failTokenizer: false,
	failHistory: false,
	failSettings: false,
	stopReason: null,
	ramGb: 8,
	tokenDelayMs: 25,
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

async function runInference(args: {
	prompt: string;
	maxTokens: number;
	assistantPrefix: string | null;
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
	const pieces = full.match(/\S+\s*/g) ?? [];
	const forced = knobs.stopReason;
	knobs.stopReason = null;
	const limit = forced === "length" ? Math.min(12, pieces.length) : pieces.length;
	const started = performance.now();
	let sent = 0;
	let reason: StopReason = forced ?? "eos";
	await sleep(300);
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
		data: { total_tokens: sent, duration_ms: Math.round(performance.now() - started), stop_reason: reason },
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
	if (knobs.failTokenizer) {
		knobs.failTokenizer = false;
		persist();
		const error = "The model downloaded but its tokenizer could not be fetched. Retry to finish.";
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
		activeModel = { id: info.id, name: info.name };
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
