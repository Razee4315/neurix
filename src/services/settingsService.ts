import { invoke } from "@tauri-apps/api/core";
import type { Settings, StorageInfo } from "./types";

export async function getSettings(): Promise<Settings> {
	return invoke("get_settings");
}

export async function updateSettings(settings: Settings): Promise<void> {
	return invoke("update_settings", { settings });
}

export async function getStorageInfo(): Promise<StorageInfo> {
	return invoke("get_storage_info");
}

export async function checkAvailableSpace(requiredBytes: number): Promise<boolean> {
	return invoke("check_available_space", { requiredBytes });
}

export async function getAvailableSpace(): Promise<number> {
	return invoke("get_available_space");
}
