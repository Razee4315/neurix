import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import type { Backup, ImportSummary } from "./types";

const JSON_FILTER = [{ name: "Neurix backup", extensions: ["json"] }];

/**
 * Ask where to save, then write a backup of chats and custom characters.
 * Resolves with false if the user dismissed the file picker.
 */
export async function exportToFile(): Promise<boolean> {
	const backup = await invoke<Backup>("export_data");
	const stamp = new Date().toISOString().slice(0, 10);
	const path = await save({
		defaultPath: `neurix-backup-${stamp}.json`,
		filters: JSON_FILTER,
	});
	if (!path) return false;
	await writeTextFile(path, JSON.stringify(backup, null, 2));
	return true;
}

/**
 * Ask for a backup file and merge it into this device.
 * Resolves with null if the user dismissed the file picker.
 */
export async function importFromFile(): Promise<ImportSummary | null> {
	const path = await open({ multiple: false, directory: false, filters: JSON_FILTER });
	if (!path) return null;
	let backup: unknown;
	try {
		backup = JSON.parse(await readTextFile(path));
	} catch {
		throw new Error("That file isn't valid JSON.");
	}
	return invoke<ImportSummary>("import_data", { backup });
}
