import type { ActiveModel } from "@/services/types";

/**
 * Which model the app has in memory, as the UI sees it. Pure: the provider
 * in `AppContext.tsx` does the IPC. See STATE_MACHINES.md (M1).
 *
 * The backend serializes loads (a load asked for during another waits for
 * it), so the front end only has to track the *latest* request: every load
 * gets a ticket, and the outcome of anything but the latest is ignored.
 */
export type ModelStatus =
	| { kind: "idle" }
	/** A load is reading the file. Nothing is usable until it ends. */
	| { kind: "loading"; id: string }
	| { kind: "ready"; model: ActiveModel };

export interface ModelState {
	status: ModelStatus;
	/** Ticket of the latest load started. */
	ticket: number;
}

export const initialModelState: ModelState = { status: { kind: "idle" }, ticket: 0 };

export type ModelAction =
	| { type: "LOAD_STARTED"; id: string; ticket: number }
	/** The load ended (either way); `model` is what the backend now reports. */
	| { type: "LOAD_ENDED"; ticket: number; model: ActiveModel | null }
	/** The caller gave up waiting. The backend may still finish it later. */
	| { type: "LOAD_ABANDONED"; ticket: number }
	/** A plain refresh of what the backend reports. */
	| { type: "SYNCED"; model: ActiveModel | null };

function from(model: ActiveModel | null): ModelStatus {
	return model ? { kind: "ready", model } : { kind: "idle" };
}

export function modelReducer(state: ModelState, action: ModelAction): ModelState {
	switch (action.type) {
		case "LOAD_STARTED":
			return { status: { kind: "loading", id: action.id }, ticket: action.ticket };
		case "LOAD_ENDED":
			// A newer load is on its way: its own end decides.
			if (action.ticket !== state.ticket) return state;
			return { ...state, status: from(action.model) };
		case "LOAD_ABANDONED":
			if (action.ticket !== state.ticket || state.status.kind !== "loading") return state;
			return { ...state, status: { kind: "idle" } };
		case "SYNCED":
			// Mid-load the backend reports nothing yet; the load's end will tell.
			if (state.status.kind === "loading") return state;
			return { ...state, status: from(action.model) };
	}
}

export function activeOf(status: ModelStatus): ActiveModel | null {
	return status.kind === "ready" ? status.model : null;
}

export function loadingIdOf(status: ModelStatus): string | null {
	return status.kind === "loading" ? status.id : null;
}
