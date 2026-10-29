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
/** Words worth matching: lowercase, 3+ letters, no common filler. */
const STOP = new Set("the and for with that this what who how why when where which from have are was were you your about into does did can could would should will there their them they his her its our out not all any".split(" "));
function words(text: string): string[] {
	return (text.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []).filter((w) => !STOP.has(w));
}

/**
 * Pick the files that matter for this question. A folder can hold far more
 * than a small model reads, so files are scored by how many of the
 * question's words appear in their name and text, and the best fill the
 * budget. With no matching words, the first files are used.
 */
function relevantFiles(files: FolderSnapshot["files"], question: string, budget: number) {
	const q = new Set(words(question));
	const scored = files
		.filter((f) => f.content)
		.map((f, i) => {
			const hay = `${f.path} ${f.content}`.toLowerCase();
			let score = 0;
			for (const w of q) if (hay.includes(w)) score += f.path.toLowerCase().includes(w) ? 3 : 1;
			return { f, score, i };
		})
		.sort((a, b) => b.score - a.score || a.i - b.i);
	const picked: typeof files = [];
	let used = 0;
	for (const { f } of scored) {
		const text = f.content ?? "";
		if (used + text.length > budget && picked.length > 0) continue;
		picked.push({ ...f, content: text.slice(0, budget - used) });
		used += Math.min(text.length, budget - used);
		if (used >= budget) break;
	}
	return picked;
}

/** How much of each folder is read before the relevant part is picked. */
const SCAN_CHARS = 120_000;
/** File names listed for the model, so it knows what else is there. */
const LISTED_FILES = 40;

/**
 * Everything the enabled connectors know that bears on `question`, as one
 * block to put in front of it, or "" when nothing is enabled.
 */
export async function connectorContext(question = ""): Promise<string> {
	const folders = state.folders.filter((f) => f.enabled);
	const repos = state.repos.filter((r) => r.enabled);
	const sources = folders.length + repos.length + (state.gmail?.enabled && gmailPassword ? 1 : 0);
	if (sources === 0) return "";
	const share = Math.floor(CONTEXT_CHARS / sources);
	const parts: string[] = [];
	for (const folder of folders) {
		try {
			const snap = await readFolder(folder.path, SCAN_CHARS);
			const chosen = relevantFiles(snap.files, question, share);
			const names = snap.files.filter((f) => f.content !== null).map((f) => f.path);
			const listing =
				names.slice(0, LISTED_FILES).join(", ") +
				(names.length > LISTED_FILES ? ` and ${names.length - LISTED_FILES} more` : "");
			const bodies = chosen.map((f) => `--- File: ${f.path} ---\n${f.content}`).join("\n\n");
			parts.push(`Local folder "${snap.name}". Text files: ${listing || "none readable"}.\n\n${bodies}`);
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
	return parts.join("\n\n");
}

/**
 * The user's message with the connector context in front of it. Small
 * models follow material placed right next to the question much better
 * than material in the system prompt.
 */
export function withContext(context: string, question: string): string {
	if (!context) return question;
	return [
		"Use the following material from my connected sources to answer. It was read on this device.",
		"Answer from it when it is relevant and say which file, email or repository you used.",
		"If the answer is not in it, say so and then answer from general knowledge.",
		"",
		"<sources>",
		context,
		"</sources>",
		"",
		`My question: ${question}`,
	].join("\n");
}
