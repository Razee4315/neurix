import { type FolderSnapshot, readFolder } from "@/services/connectorService";
import { useSyncExternalStore } from "react";

/**
 * Connected folders, remembered on this device. Enabled folders are read
 * before each reply and handed to the model as context.
 */
export interface ConnectedFolder {
	path: string;
	name: string;
	enabled: boolean;
	/** Files found the last time the folder was read. */
	files: number;
	textFiles: number;
}

const KEY = "neurix.connectors.folders.v1";
/** Text handed to the model per reply, across all folders (~2k tokens). */
export const CONTEXT_CHARS = 8_000;

function read(): ConnectedFolder[] {
	try {
		return JSON.parse(localStorage.getItem(KEY) ?? "[]");
	} catch {
		return [];
	}
}

let folders = read();
const listeners = new Set<() => void>();

function save(next: ConnectedFolder[]) {
	folders = next;
	try {
		localStorage.setItem(KEY, JSON.stringify(next));
	} catch {
		// Storage unavailable: kept for this session only.
	}
	for (const listener of listeners) listener();
}

export function useFolders(): ConnectedFolder[] {
	return useSyncExternalStore(
		(l) => {
			listeners.add(l);
			return () => listeners.delete(l);
		},
		() => folders,
		() => folders,
	);
}

export function addFolder(snapshot: FolderSnapshot) {
	const entry: ConnectedFolder = {
		path: snapshot.path,
		name: snapshot.name,
		enabled: true,
		files: snapshot.total_files,
		textFiles: snapshot.text_files,
	};
	save([...folders.filter((f) => f.path !== snapshot.path), entry]);
}

export function setFolderEnabled(path: string, enabled: boolean) {
	save(folders.map((f) => (f.path === path ? { ...f, enabled } : f)));
}

export function removeFolder(path: string) {
	save(folders.filter((f) => f.path !== path));
}

/**
 * The enabled folders as one block of text for the system prompt, or ""
 * when none are enabled. Folders that can't be read are skipped.
 */
export async function folderContext(): Promise<string> {
	const enabled = folders.filter((f) => f.enabled);
	if (enabled.length === 0) return "";
	const share = Math.floor(CONTEXT_CHARS / enabled.length);
	const parts: string[] = [];
	for (const folder of enabled) {
		try {
			const snap = await readFolder(folder.path, share);
			const listing = snap.files.map((f) => `- ${f.path}`).join("\n");
			const bodies = snap.files
				.filter((f) => f.content)
				.map((f) => `### ${f.path}${f.truncated ? " (first part)" : ""}\n${f.content}`)
				.join("\n\n");
			parts.push(`Folder "${snap.name}" (${snap.total_files} files):\n${listing}\n\n${bodies}`);
		} catch {
			// Folder moved or unreadable: answer without it.
		}
	}
	if (parts.length === 0) return "";
	return [
		"The user connected these local folders. Their files were read on this device.",
		"Use them to answer when relevant and name the file you used. Say so if the answer is not in them.",
		"",
		parts.join("\n\n"),
	].join("\n");
}
