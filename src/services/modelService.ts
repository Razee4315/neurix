import { invoke, Channel } from "@tauri-apps/api/core";
import type { DownloadedModel, DownloadEvent, ModelInfo } from "./types";

export async function getCatalog(): Promise<ModelInfo[]> {
	return invoke("get_model_catalog");
}

export async function downloadModel(
	modelId: string,
	confirmedWifi: boolean,
	onEvent: (event: DownloadEvent) => void,
): Promise<void> {
	const channel = new Channel<DownloadEvent>();
	channel.onmessage = onEvent;
	return invoke("download_model", { modelId, confirmedWifi, onEvent: channel });
}

export async function cancelDownload(modelId: string): Promise<void> {
	return invoke("cancel_download", { modelId });
}

export async function getDownloadedModels(): Promise<DownloadedModel[]> {
	return invoke("get_downloaded_models");
}

export async function deleteModel(modelId: string): Promise<void> {
	return invoke("delete_model", { modelId });
}

export async function loadModel(modelId: string): Promise<void> {
	return invoke("load_model", { modelId });
}

export async function getActiveModel(): Promise<string | null> {
	return invoke("get_active_model");
}

export async function getActiveDownloads(): Promise<string[]> {
	return invoke("get_active_downloads");
}
