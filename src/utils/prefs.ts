import { useSyncExternalStore } from "react";

/**
 * Small interface preferences that only this device needs: kept in
 * localStorage, read with `usePrefs`, changed with `setPref`.
 */
export interface Prefs {
	/** Enter sends (Shift+Enter breaks the line). Off: Cmd/Ctrl+Enter sends. */
	enterSends: boolean;
	/** Suggested prompts on an empty chat. */
	showStarters: boolean;
	/** The privacy line under the composer. */
	showPrivacyNote: boolean;
	/** Width of the conversation column on wide windows. */
	chatWidth: "comfortable" | "wide";
	/** Copy a reply to the clipboard as soon as it finishes. */
	autoCopy: boolean;
	/** Friends keep facts you tell them in chat. */
	friendsLearn: boolean;
}

const KEY = "neurix.prefs.v1";
const DEFAULTS: Prefs = {
	enterSends: true,
	showStarters: true,
	showPrivacyNote: true,
	chatWidth: "comfortable",
	autoCopy: false,
	friendsLearn: true,
};

function read(): Prefs {
	try {
		const raw = localStorage.getItem(KEY);
		return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
	} catch {
		return DEFAULTS;
	}
}

let current = read();
const listeners = new Set<() => void>();

export function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]): void {
	current = { ...current, [key]: value };
	try {
		localStorage.setItem(KEY, JSON.stringify(current));
	} catch {
		// Storage unavailable: the change still applies for this session.
	}
	for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

const snapshot = () => current;

/** The current preferences, for code outside React's render. */
export const getPrefs = snapshot;

export function usePrefs(): Prefs {
	return useSyncExternalStore(subscribe, snapshot, snapshot);
}
