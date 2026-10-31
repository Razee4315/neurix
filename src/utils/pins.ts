import { useSyncExternalStore } from "react";

/** Chats pinned to the top of the sidebar, remembered on this device. */

const KEY = "neurix.chats.pinned.v1";
const listeners = new Set<() => void>();

function read(): string[] {
	try {
		const raw = localStorage.getItem(KEY);
		const list: unknown = raw ? JSON.parse(raw) : [];
		return Array.isArray(list) ? list.filter((id): id is string => typeof id === "string") : [];
	} catch {
		return [];
	}
}

let pins = read();

export function togglePin(id: string) {
	pins = pins.includes(id) ? pins.filter((p) => p !== id) : [id, ...pins];
	try {
		localStorage.setItem(KEY, JSON.stringify(pins));
	} catch {
		// Storage unavailable: the pin lasts for this session.
	}
	for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

export function usePins(): string[] {
	return useSyncExternalStore(subscribe, () => pins);
}
