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

export interface MailSummary {
	from: string;
	subject: string;
	date: string;
	snippet: string;
}

/** The newest emails in a Gmail inbox, read over IMAP on this device. */
export async function gmailFetch(email: string, appPassword: string, limit: number): Promise<MailSummary[]> {
	return invoke("gmail_fetch", { email, appPassword, limit });
}

export interface GithubSnapshot {
	repo: string;
	description: string;
	stars: number;
	language: string;
	readme: string;
	open_items: { number: number; title: string; kind: string }[];
}

/** Public data of a GitHub repository. */
export async function githubFetch(repo: string): Promise<GithubSnapshot> {
	return invoke("github_fetch", { repo });
}
