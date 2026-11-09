/**
 * What the download page does once a model has finished downloading.
 * See STATE_MACHINES.md (M5).
 *
 *   waiting ──finished──▶ scheduled ──after HANDOFF_DELAY_MS──▶ (open-models | first-chat)
 *                            │
 *                            └──page closed──▶ cancelled (nothing happens)
 */
export const HANDOFF_DELAY_MS = 1200;

export type HandoffTarget =
	/** Something is already loaded: show the new model without switching to it. */
	| "models"
	/** A first install: load it and open a chat. */
	| "first-chat";

export function handoffTarget(activeModelId: string | null): HandoffTarget {
	return activeModelId ? "models" : "first-chat";
}
