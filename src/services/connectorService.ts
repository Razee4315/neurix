import { invoke } from "@tauri-apps/api/core";

export interface FolderSnapshot {
	name: string;
	path: string;
	total_files: number;
	/** Files that were actually read as text. */
	text_files: string[];
	/** Other formats, or files that turned out not to be text. */
	unreadable: string[];
	/** True when the folder was too big to read all of it. */
	partial: boolean;
}

export interface FolderSearch {
	folder: FolderSnapshot;
	/** The passages that match the question, best first. */
	excerpts: { path: string; text: string }[];
	/** Unreadable files the question seems to be about. */
	unreadable_matches: string[];
}

/** Native folder picker. Resolves to null when the user cancels. */
export async function pickFolder(): Promise<string | null> {
	return invoke("pick_folder");
}

/** What a folder holds and which of its files can be read. */
export async function readFolder(path: string): Promise<FolderSnapshot> {
	return invoke("read_folder", { path });
}

/** Search a folder's text files, keeping up to `maxChars` of the best passages. */
export async function searchFolder(path: string, question: string, maxChars: number): Promise<FolderSearch> {
	return invoke("search_folder", { path, question, maxChars });
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
