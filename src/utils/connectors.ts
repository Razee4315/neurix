import {
	type FolderSnapshot,
	type GithubSnapshot,
	type MailSummary,
	githubFetch,
	gmailFetch,
	readFolder,
} from "@/services/connectorService";
import { useSyncExternalStore } from "react";

/**
 * Connected sources, remembered on this device: local folders, a Gmail
 * inbox and GitHub repositories. Enabled sources are read before each reply
 * and handed to the model as context.
 */
export interface ConnectedFolder {
	path: string;
	name: string;
	enabled: boolean;
	/** Files found the last time the folder was read. */
	files: number;
	textFiles: number;
}

export interface GmailAccount {
	email: string;
	enabled: boolean;
	/** False after a restart: the app password is kept in memory only. */
	signedIn: boolean;
}

export interface ConnectedRepo {
	repo: string;
	enabled: boolean;
	description: string;
}

interface State {
	folders: ConnectedFolder[];
	gmail: GmailAccount | null;
	repos: ConnectedRepo[];
}

const KEY = "neurix.connectors.v2";
const OLD_FOLDERS_KEY = "neurix.connectors.folders.v1";
/** Text handed to the model per reply, across all sources (~2k tokens). */
export const CONTEXT_CHARS = 8_000;
const GMAIL_LIMIT = 8;
const GMAIL_CACHE_MS = 2 * 60_000;
const GITHUB_CACHE_MS = 10 * 60_000;

function read(): State {
	try {
		const raw = localStorage.getItem(KEY);
		if (raw) {
			const s = JSON.parse(raw) as State;
			return { ...s, gmail: s.gmail ? { ...s.gmail, signedIn: false } : null };
		}
		return { folders: JSON.parse(localStorage.getItem(OLD_FOLDERS_KEY) ?? "[]"), gmail: null, repos: [] };
	} catch {
		return { folders: [], gmail: null, repos: [] };
	}
}

let state = read();
/** Never written to disk. */
let gmailPassword: string | null = null;
let mailCache: { at: number; mails: MailSummary[] } | null = null;
const repoCache = new Map<string, { at: number; snap: GithubSnapshot }>();
const listeners = new Set<() => void>();

function save(next: State) {
	state = next;
	try {
		localStorage.setItem(KEY, JSON.stringify(next));
	} catch {
		// Storage unavailable: kept for this session only.
	}
	for (const listener of listeners) listener();
}

function subscribe(l: () => void) {
	listeners.add(l);
	return () => listeners.delete(l);
}

export function useConnectors(): State {
	return useSyncExternalStore(subscribe, () => state, () => state);
}

export function useFolders(): ConnectedFolder[] {
	return useConnectors().folders;
}

export function addFolder(snapshot: FolderSnapshot) {
	const entry: ConnectedFolder = {
		path: snapshot.path,
		name: snapshot.name,
		enabled: true,
		files: snapshot.total_files,
		textFiles: snapshot.text_files,
	};
	save({ ...state, folders: [...state.folders.filter((f) => f.path !== snapshot.path), entry] });
}

export function setFolderEnabled(path: string, enabled: boolean) {
	save({ ...state, folders: state.folders.map((f) => (f.path === path ? { ...f, enabled } : f)) });
}

export function removeFolder(path: string) {
	save({ ...state, folders: state.folders.filter((f) => f.path !== path) });
}

/** Sign in to Gmail and read the inbox once to prove it works. */
export async function connectGmail(email: string, appPassword: string): Promise<MailSummary[]> {
	const mails = await gmailFetch(email.trim(), appPassword, GMAIL_LIMIT);
	gmailPassword = appPassword;
	mailCache = { at: Date.now(), mails };
	save({ ...state, gmail: { email: email.trim(), enabled: true, signedIn: true } });
	return mails;
}

export function setGmailEnabled(enabled: boolean) {
	if (state.gmail) save({ ...state, gmail: { ...state.gmail, enabled } });
}

export function disconnectGmail() {
	gmailPassword = null;
	mailCache = null;
	save({ ...state, gmail: null });
}

export async function connectRepo(repo: string): Promise<GithubSnapshot> {
	const snap = await githubFetch(repo);
	repoCache.set(snap.repo, { at: Date.now(), snap });
	const entry = { repo: snap.repo, enabled: true, description: snap.description };
	save({ ...state, repos: [...state.repos.filter((r) => r.repo !== snap.repo), entry] });
	return snap;
}

export function setRepoEnabled(repo: string, enabled: boolean) {
	save({ ...state, repos: state.repos.map((r) => (r.repo === repo ? { ...r, enabled } : r)) });
}

export function removeRepo(repo: string) {
	repoCache.delete(repo);
	save({ ...state, repos: state.repos.filter((r) => r.repo !== repo) });
}

async function gmailBlock(): Promise<string> {
	const g = state.gmail;
	if (!g?.enabled || !gmailPassword) return "";
	if (!mailCache || Date.now() - mailCache.at > GMAIL_CACHE_MS) {
		mailCache = { at: Date.now(), mails: await gmailFetch(g.email, gmailPassword, GMAIL_LIMIT) };
	}
	const lines = mailCache.mails.map(
		(m, i) => `${i + 1}. From: ${m.from}\n   Subject: ${m.subject}\n   Date: ${m.date}\n   ${m.snippet.slice(0, 400)}`,
	);
	return `Gmail inbox of ${g.email}, newest ${lines.length} emails:\n${lines.join("\n")}`;
}

async function repoBlock(repo: ConnectedRepo, chars: number): Promise<string> {
	let cached = repoCache.get(repo.repo);
	if (!cached || Date.now() - cached.at > GITHUB_CACHE_MS) {
		cached = { at: Date.now(), snap: await githubFetch(repo.repo) };
		repoCache.set(repo.repo, cached);
	}
	const s = cached.snap;
	const items = s.open_items.map((i) => `- #${i.number} (${i.kind}) ${i.title}`).join("\n") || "- none";
	return `GitHub repository ${s.repo} (${s.language || "unknown language"}, ${s.stars} stars): ${s.description}\nOpen issues and pull requests:\n${items}\nREADME (start):\n${s.readme.slice(0, chars)}`;
}

/**
 * The enabled folders as one block of text for the system prompt, or ""
 * when none are enabled. Folders that can't be read are skipped.
 */
export async function connectorContext(): Promise<string> {
	const folders = state.folders.filter((f) => f.enabled);
	const repos = state.repos.filter((r) => r.enabled);
	const sources = folders.length + repos.length + (state.gmail?.enabled && gmailPassword ? 1 : 0);
	if (sources === 0) return "";
	const share = Math.floor(CONTEXT_CHARS / sources);
	const parts: string[] = [];
	for (const folder of folders) {
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
	try {
		const mail = await gmailBlock();
		if (mail) parts.push(mail.slice(0, share));
	} catch {
		// Offline or signed out: answer without the inbox.
	}
	for (const repo of repos) {
		try {
			parts.push((await repoBlock(repo, share)).slice(0, share));
		} catch {
			// Offline: answer without the repository.
		}
	}
	if (parts.length === 0) return "";
	return [
		"The user connected these sources. They were read by this app on the user's device.",
		"Use them to answer when relevant and say which source you used. Say so if the answer is not in them.",
		"",
		parts.join("\n\n"),
	].join("\n");
}
