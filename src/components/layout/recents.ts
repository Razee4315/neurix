import type { ConversationMeta } from "@/services/types";

/**
 * The sidebar's list of recent chats, including a chat that has just
 * started and is not saved yet ("pending"). See STATE_MACHINES.md (M8).
 *
 *   pending ──its first save lands (shows up in the list)──▶ saved
 *      │
 *      └──its save failed──▶ dropped
 */
export type RecentEntry = ConversationMeta & { pending?: boolean };

/** A chat has started: show it on top straight away. */
export function addPending(prev: RecentEntry[] | null, id: string, title: string, now = new Date()): RecentEntry[] {
	return [
		{ id, title, model_name: "", updated_at: now.toISOString(), pending: true },
		...(prev ?? []).filter((c) => c.id !== id),
	];
}

/** A fresh list from disk. A pending chat stays on top until its first save shows up in it. */
export function mergeSaved(prev: RecentEntry[] | null, saved: ConversationMeta[]): RecentEntry[] {
	const pending = (prev ?? []).filter((p) => p.pending && !saved.some((c) => c.id === p.id));
	return [...pending, ...saved];
}

/** Saving failed: a chat that was never saved is not in history, so it leaves the list. */
export function dropPending(prev: RecentEntry[] | null, id: string): RecentEntry[] | null {
	if (!prev?.some((c) => c.id === id && c.pending)) return prev;
	return prev.filter((c) => !(c.id === id && c.pending));
}
