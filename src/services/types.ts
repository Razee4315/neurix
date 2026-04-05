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
	company: string;
	parameters: string;
	quantization: string;
	best_for: string[];
}

export type ChatTemplate = "Llama3" | "SmolLM" | "Gemma" | "Phi3" | "Qwen";

export interface DownloadEvent {
	event: "Started" | "Progress" | "Finished" | "Failed" | "Cancelled";
	data?: DownloadStarted | DownloadProgress | DownloadFailed;
}

export interface DownloadStarted {
	total_bytes: number;
}

export interface DownloadProgress {
	bytes_downloaded: number;
	total_bytes: number;
	speed_bps: number;
}

export interface DownloadFailed {
	error: string;
}

export interface DownloadedModel {
	id: string;
	name: string;
	size_bytes: number;
	size_label: string;
	tag: string;
}

export interface InferenceEvent {
	event: "TokenGenerated" | "GenerationComplete" | "Error";
	data?: TokenGenerated | GenerationComplete | InferenceError;
}

export interface TokenGenerated {
	token: string;
	tokens_per_second: number;
}

export interface GenerationComplete {
	total_tokens: number;
	duration_ms: number;
}

export interface InferenceError {
	message: string;
}

export interface Settings {
	wifi_only: boolean;
	save_history: boolean;
	show_speed: boolean;
	system_prompt: string;
	temperature: number;
	top_p: number;
	max_tokens: number;
	font_size?: string;
	last_model_id?: string | null;
}

export interface StorageInfo {
	used_bytes: number;
	models_count: number;
}

export interface Conversation {
	id: string;
	title: string;
	model_id: string;
	model_name: string;
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
	updated_at: string;
}
