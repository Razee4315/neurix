import {
	type FolderSearch,
	type FolderSnapshot,
	type GithubSnapshot,
	type MailSummary,
	githubFetch,
	gmailFetch,
	searchFolder,
} from "@/services/connectorService";
import { useSyncExternalStore } from "react";

/**
 * Connected sources, remembered on this device: local folders (desktop),
 * documents picked on a phone, a Gmail inbox and GitHub repositories.
 * Enabled sources are read before each reply and handed to the model as
 * context.
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

/**
 * A text file picked on a phone. Phones can't hand an app a whole folder
 * to read later, so the text is copied in when the file is picked.
 */
export interface ConnectedDoc {
	id: string;
	name: string;
	enabled: boolean;
	text: string;
	/** True when the file was longer than `DOC_CHARS` and was cut. */
	truncated: boolean;
}

interface State {
	folders: ConnectedFolder[];
	docs: ConnectedDoc[];
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
/** Text kept per document, and how many documents, so storage stays small. */
const DOC_CHARS = 40_000;
const MAX_DOCS = 20;
/** Extensions read as text when the picker gives no useful type. */
const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|ya?ml|toml|xml|html?|log|ini|rtf|tex|srt|vtt)$/i;

function read(): State {
	try {
		const raw = localStorage.getItem(KEY);
		if (raw) {
			const s = JSON.parse(raw) as State;
			return { ...s, docs: s.docs ?? [], gmail: s.gmail ? { ...s.gmail, signedIn: false } : null };
		}
		return {
			folders: JSON.parse(localStorage.getItem(OLD_FOLDERS_KEY) ?? "[]"),
			docs: [],
			gmail: null,
			repos: [],
		};
	} catch {
		return { folders: [], docs: [], gmail: null, repos: [] };
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
		textFiles: snapshot.text_files.length,
	};
	save({ ...state, folders: [...state.folders.filter((f) => f.path !== snapshot.path), entry] });
}

export function setFolderEnabled(path: string, enabled: boolean) {
	save({ ...state, folders: state.folders.map((f) => (f.path === path ? { ...f, enabled } : f)) });
}

export function removeFolder(path: string) {
	save({ ...state, folders: state.folders.filter((f) => f.path !== path) });
}

/**
 * Copy picked files in as documents. Files that aren't text (images, PDFs,
 * Word files) are skipped and named in `skipped`.
 */
export async function addDocuments(files: File[]): Promise<{ added: ConnectedDoc[]; skipped: string[] }> {
	const added: ConnectedDoc[] = [];
	const skipped: string[] = [];
	for (const file of files) {
		const looksText = file.type.startsWith("text/") || file.type === "application/json" || TEXT_EXT.test(file.name);
		if (!looksText) {
			skipped.push(file.name);
			continue;
		}
		try {
			const full = await file.text();
			if (full.slice(0, 2000).includes("\u0000")) {
				skipped.push(file.name);
				continue;
			}
			added.push({
				id: `${file.name}:${file.size}:${file.lastModified}`,
				name: file.name,
				enabled: true,
				text: full.slice(0, DOC_CHARS),
				truncated: full.length > DOC_CHARS,
			});
		} catch {
			skipped.push(file.name);
		}
	}
	if (added.length > 0) {
		const ids = new Set(added.map((d) => d.id));
		const docs = [...state.docs.filter((d) => !ids.has(d.id)), ...added].slice(-MAX_DOCS);
		save({ ...state, docs });
	}
	return { added, skipped };
}

export function setDocEnabled(id: string, enabled: boolean) {
	save({ ...state, docs: state.docs.map((d) => (d.id === id ? { ...d, enabled } : d)) });
}

/** Turn every document on or off at once (the chip under the message box). */
export function setAllDocsEnabled(enabled: boolean) {
	save({ ...state, docs: state.docs.map((d) => ({ ...d, enabled })) });
}

export function removeDoc(id: string) {
	save({ ...state, docs: state.docs.filter((d) => d.id !== id) });
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

interface PickedFile {
	path: string;
	content: string;
}

/**
 * Pick the documents that matter for this question. They can hold far more
 * than a small model reads, so they are scored by how many of the question's
 * words appear in their name and text, and the best fill the budget. With no
 * matching words, the first documents are used.
 */
function relevantFiles(files: PickedFile[], question: string, budget: number) {
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
	const picked: PickedFile[] = [];
	let used = 0;
	for (const { f } of scored) {
		const text = f.content;
		if (used + text.length > budget && picked.length > 0) continue;
		picked.push({ ...f, content: text.slice(0, budget - used) });
		used += Math.min(text.length, budget - used);
		if (used >= budget) break;
	}
	return picked;
}

/** File names listed for the model when asked what is in a folder. */
const LISTED_FILES = 40;
/** Questions about the folder itself rather than what its files say. */
const ABOUT_FILES = /\b(files?|folders?|documents?|docs?)\b/i;

/**
 * What the model is told about one folder. Reading is the slow part on a
 * phone or laptop, so a question the files can't help with costs one line.
 */
export function folderBlock({ folder, excerpts, unreadable_matches }: FolderSearch, question: string): string {
	const lines = [`Local folder "${folder.name}".`];
	for (const file of unreadable_matches) {
		lines.push(`${file} is in this folder, but it can't be read, so what it says is unknown.`);
	}
	if (excerpts.length > 0) {
		lines.push(...excerpts.map((e) => `--- File: ${e.path} ---\n${e.text}`));
	} else if (ABOUT_FILES.test(question)) {
		const names = folder.text_files;
		const more = names.length > LISTED_FILES ? ` and ${names.length - LISTED_FILES} more` : "";
		lines.push(`Readable files: ${names.slice(0, LISTED_FILES).join(", ") || "none"}${more}.`);
		if (folder.unreadable.length > 0) lines.push(`Files that can't be read: ${folder.unreadable.slice(0, LISTED_FILES).join(", ")}.`);
	} else {
		lines.push("Nothing in its files matches this question.");
	}
	if (folder.partial) lines.push("The folder is very large, so only part of it was searched.");
	return lines.join("\n\n");
}

export interface ConnectorContext {
	/** The material to put in front of the question, or "". */
	text: string;
	/** Sources that were on but couldn't be read, to tell the user. */
	warnings: string[];
}

/**
 * Everything the enabled connectors know that bears on `question`, as one
 * block to put in front of it, with "" when nothing is enabled.
 */
export async function connectorContext(question = ""): Promise<ConnectorContext> {
	const folders = state.folders.filter((f) => f.enabled);
	const docs = state.docs.filter((d) => d.enabled);
	const repos = state.repos.filter((r) => r.enabled);
	const sources =
		folders.length + repos.length + (docs.length > 0 ? 1 : 0) + (state.gmail?.enabled && gmailPassword ? 1 : 0);
	if (sources === 0) return { text: "", warnings: [] };
	const share = Math.floor(CONTEXT_CHARS / sources);
	const parts: string[] = [];
	const warnings: string[] = [];
	for (const folder of folders) {
		try {
			parts.push(folderBlock(await searchFolder(folder.path, question, share), question));
		} catch {
			// Say so to both: the model must not act as if it had read the folder.
			parts.push(`Local folder "${folder.name}" could not be read, so its files are not available.`);
			warnings.push(`Couldn't read ${folder.name}. It may have been moved or renamed.`);
		}
	}
	if (docs.length > 0) {
		const files = docs.map((d) => ({ path: d.name, content: d.text }));
		const chosen = relevantFiles(files, question, share);
		const bodies = chosen.map((f) => `--- File: ${f.path} ---\n${f.content}`).join("\n\n");
		parts.push(`Documents shared from this device: ${docs.map((d) => d.name).join(", ")}.\n\n${bodies}`);
	}
	try {
		const mail = await gmailBlock();
		if (mail) parts.push(mail.slice(0, share));
	} catch {
		parts.push("The Gmail inbox could not be read just now.");
		warnings.push("Couldn't read Gmail. Check your connection.");
	}
	for (const repo of repos) {
		try {
			parts.push((await repoBlock(repo, share)).slice(0, share));
		} catch {
			parts.push(`The GitHub repository ${repo.repo} could not be read just now.`);
			warnings.push(`Couldn't read ${repo.repo}. Check your connection.`);
		}
	}
	return { text: parts.join("\n\n"), warnings };
}

/**
 * The user's message with the connector context in front of it. Small
 * models follow material placed right next to the question much better
 * than material in the system prompt.
 */
export function withContext(context: string, question: string): string {
	if (!context) return question;
	return [
		"Use the following material from my connected sources to answer.",
		"Copy names, numbers and dates exactly as written, and say which file, email or repository you used.",
		"If my question is about my sources and the answer is not in them, say you could not find it there. Never guess or fill in a blank.",
		"If my question has nothing to do with them, just answer it.",
		"",
		"<sources>",
		context,
		"</sources>",
		"",
		`My question: ${question}`,
	].join("\n");
}
