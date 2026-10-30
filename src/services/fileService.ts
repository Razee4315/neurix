import { invoke } from "@tauri-apps/api/core";

/** Ask where to save a file. Resolves to its path, or null when cancelled. */
export async function saveFileAs(name: string, content: string): Promise<string | null> {
	return invoke("save_file_as", { name, content });
}

/** Whether a file exists in the folder. Rejects when the name isn't allowed. */
export async function checkWorkspaceFile(folder: string, name: string): Promise<boolean> {
	return invoke("check_workspace_file", { folder, name });
}

/** Write an approved file into the folder and return its full path. */
export async function writeWorkspaceFile(
	folder: string,
	name: string,
	content: string,
	overwrite: boolean,
): Promise<string> {
	return invoke("write_workspace_file", { folder, name, content, overwrite });
}

/** Open a written file in the app the system uses for that kind of file. */
export async function openWorkspaceFile(path: string): Promise<void> {
	return invoke("open_workspace_file", { path });
}
