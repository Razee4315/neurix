import { invoke } from "@tauri-apps/api/core";
import type { DeviceInfo, Settings, StorageInfo } from "./types";

export async function getSettings(): Promise<Settings> {
	return invoke("get_settings");
}

/**
 * Change only the given fields. The backend merges them into the stored
 * settings, so a caller holding an older copy cannot overwrite fields it
 * did not mean to touch. Resolves with the settings as stored.
 */
export async function patchSettings(patch: Partial<Settings>): Promise<Settings> {
	return invoke("patch_settings", { patch });
}

/** Restore defaults, keeping custom characters and the last-used model. */
export async function resetSettings(): Promise<Settings> {
	return invoke("reset_settings");
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

export async function getDeviceInfo(): Promise<DeviceInfo> {
	return invoke("get_device_info");
}
