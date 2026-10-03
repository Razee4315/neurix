import { Channel, invoke } from "@tauri-apps/api/core";
import type {
	ActiveModel,
	DownloadEvent,
	DownloadedModel,
	ModelInfo,
	PartialDownload,
} from "./types";

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

/** Stop a download but keep the partial file so it can resume. */
export async function pauseDownload(modelId: string): Promise<void> {
	return invoke("cancel_download", { modelId, discard: false });
}

/** Stop a download and delete what was downloaded so far. */
export async function discardDownload(modelId: string): Promise<void> {
	return invoke("cancel_download", { modelId, discard: true });
}

export async function getDownloadedModels(): Promise<DownloadedModel[]> {
	return invoke("get_downloaded_models");
}

export async function getPartialDownloads(): Promise<PartialDownload[]> {
	return invoke("get_partial_downloads");
}

export async function getActiveDownloads(): Promise<string[]> {
	return invoke("get_active_downloads");
}

export async function deleteModel(modelId: string): Promise<void> {
	return invoke("delete_model", { modelId });
}

export async function loadModel(modelId: string): Promise<void> {
	return invoke("load_model", { modelId });
}

export async function unloadModel(): Promise<void> {
	return invoke("unload_model");
}

export async function getActiveModel(): Promise<ActiveModel | null> {
	return invoke("get_active_model");
}
