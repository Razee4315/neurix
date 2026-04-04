import { invoke, Channel } from "@tauri-apps/api/core";
import type { InferenceEvent } from "./types";

export interface ChatHistoryEntry {
	user: string;
	assistant: string;
}

export async function runInference(
	prompt: string,
	systemPrompt: string,
	history: ChatHistoryEntry[],
	temperature: number,
	topP: number,
	maxTokens: number,
	onEvent: (event: InferenceEvent) => void,
): Promise<void> {
	const channel = new Channel<InferenceEvent>();
	channel.onmessage = onEvent;
	return invoke("run_inference", {
		prompt,
		systemPrompt,
		history,
		temperature,
		topP,
		maxTokens,
		onEvent: channel,
	});
}

export async function stopInference(): Promise<void> {
	return invoke("stop_inference");
}
