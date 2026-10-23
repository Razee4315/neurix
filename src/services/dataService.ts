import { invoke } from "@tauri-apps/api/core";
import type { ImportSummary } from "./types";

/**
 * Ask where to save (native dialog), then write a backup of chats and
 * custom characters there. Resolves with false if the dialog was dismissed.
 *
 * The dialog, the file read/write and the path itself never reach the
 * webview: the backend command owns all of it.
 */
export async function exportToFile(): Promise<boolean> {
	const path = await invoke<string | null>("export_data_to_file");
	return path != null;
}

/**
 * Ask for a backup file (native dialog) and merge it into this device.
 * Resolves with null if the dialog was dismissed.
 */
export async function importFromFile(): Promise<ImportSummary | null> {
	return invoke<ImportSummary | null>("import_data_from_file");
}
