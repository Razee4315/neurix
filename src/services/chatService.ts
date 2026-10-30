import { Channel, invoke } from "@tauri-apps/api/core";
import type { BenchmarkResult, InferenceEvent } from "./types";

export interface ChatHistoryEntry {
	user: string;
	assistant: string;
}

export interface InferenceRequest {
	prompt: string;
	systemPrompt: string;
	history: ChatHistoryEntry[];
	temperature: number;
	topP: number;
	maxTokens: number;
	/**
	 * Text the assistant already produced for this turn. When set, the model
	 * continues that reply instead of starting a new one.
	 */
	assistantPrefix?: string;
	/** Ask the model to reason before answering, where it is able to. */
	enableThinking?: boolean;
}

const BUSY_RETRY_MS = 500;
/** Long enough for the slowest chunk on a busy laptop. */
const BUSY_RETRIES = 60;

export async function runInference(
	request: InferenceRequest,
	onEvent: (event: InferenceEvent) => void,
): Promise<void> {
	const channel = new Channel<InferenceEvent>();
	channel.onmessage = onEvent;
	// A stopped reply finishes its current chunk first. Sending right after
	// one, such as by leaving a chat mid-reply, only needs a short wait.
	for (let attempt = 0; ; attempt++) {
		try {
			return await invoke("run_inference", {
				...request,
				assistantPrefix: request.assistantPrefix ?? null,
				enableThinking: request.enableThinking ?? false,
				onEvent: channel,
			});
		} catch (err) {
			if (attempt >= BUSY_RETRIES || !String(err).includes("still busy")) throw err;
			await new Promise((resolve) => setTimeout(resolve, BUSY_RETRY_MS));
		}
	}
}

export async function stopInference(): Promise<void> {
	return invoke("stop_inference");
}

/** Measure how fast the loaded model runs on this device. */
export async function benchmarkModel(): Promise<BenchmarkResult> {
	return invoke("benchmark_model");
}
