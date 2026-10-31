/**
 * What was being typed, kept per chat. A draft stays with its chat rather
 * than following the user around, and survives a restart.
 */

const KEY = "neurix.chat.drafts.v1";
const OLD_KEY = "neurix.chat.draft";
/** Oldest drafts go first past this, so storage can't grow forever. */
const MAX_DRAFTS = 40;
/** The draft of a chat that hasn't been saved yet. */
export const NEW_CHAT = "new";

type Drafts = Record<string, string>;

function read(): Drafts {
	try {
		const raw = localStorage.getItem(KEY);
		if (raw) return JSON.parse(raw) as Drafts;
		const old = localStorage.getItem(OLD_KEY);
		return old ? { [NEW_CHAT]: old } : {};
	} catch {
		return {};
	}
}

export function readDraft(chatId: string | null): string {
	return read()[chatId ?? NEW_CHAT] ?? "";
}

export function writeDraft(chatId: string | null, text: string) {
	try {
		const drafts = read();
		const id = chatId ?? NEW_CHAT;
		// Removed first, so the newest write is always last in the list.
		delete drafts[id];
		if (text) drafts[id] = text;
		const ids = Object.keys(drafts);
		for (const old of ids.slice(0, Math.max(0, ids.length - MAX_DRAFTS))) delete drafts[old];
		localStorage.setItem(KEY, JSON.stringify(drafts));
		localStorage.removeItem(OLD_KEY);
	} catch {
		// Storage unavailable: the draft just won't survive leaving the page.
	}
}
