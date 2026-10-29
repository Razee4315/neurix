import { invoke } from "@tauri-apps/api/core";

export interface FolderFile {
	path: string;
	size_bytes: number;
	content: string | null;
	truncated: boolean;
}

export interface FolderSnapshot {
	name: string;
	path: string;
	total_files: number;
	text_files: number;
	files: FolderFile[];
}

/** Native folder picker. Resolves to null when the user cancels. */
export async function pickFolder(): Promise<string | null> {
	return invoke("pick_folder");
}

/** List a folder and read its text files, up to `maxChars` in total. */
export async function readFolder(path: string, maxChars: number): Promise<FolderSnapshot> {
	return invoke("read_folder", { path, maxChars });
}
