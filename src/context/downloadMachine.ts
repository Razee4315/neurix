import type { DownloadEvent, ModelInfo } from "@/services/types";

/**
 * The download state machine. Pure: no React, no IPC, no timers. The
 * provider in `DownloadContext.tsx` owns the side effects (native calls,
 * notifications) and drives this reducer with typed actions.
 *
 * See STATE_MACHINES.md (M2) for the diagram.
 *
 * Every entry carries an `attempt`, a number unique across the session.
 * Anything asynchronous (the pre-download checks, native events) is tagged
 * with the attempt it belongs to and is ignored once that attempt is over,
 * so a cancelled or superseded run can never move a newer one.
 */

/** Why a download is not running. */
export type PauseReason =
	/** The user pressed Pause. */
	| "user"
	/** The WiFi-only rule stopped it before it began. */
	| "wifi-blocked"
	/** WiFi dropped mid-transfer; it resumes on its own when WiFi returns. */
	| "wifi-lost"
	/** Left over from an earlier session, or stopped by the system. */
	| "interrupted";

export type DownloadPhase =
	/** Pre-flight checks (online, WiFi rule, free space). Nothing native yet. */
	| { kind: "checking" }
	| { kind: "downloading" }
	/** Transfer complete; the file's size and checksum are being checked. */
	| { kind: "verifying" }
	/**
	 * Asked the native side to stop; waiting for its Cancelled event.
	 * `resume` is set when a start was requested meanwhile: it happens as
	 * soon as the transfer has stopped, instead of being dropped.
	 */
	| { kind: "pausing"; reason: "user" | "wifi-lost"; resume: boolean }
	| { kind: "paused"; reason: PauseReason; message?: string }
	| { kind: "failed"; error: string }
	| { kind: "finished" };

export type PhaseKind = DownloadPhase["kind"];

export interface DownloadEntry {
	model: ModelInfo;
	attempt: number;
	phase: DownloadPhase;
	totalBytes: number;
	downloadedBytes: number;
	speedBps: number;
	/** The user agreed to download this one off WiFi; the rule is not applied again. */
	allowMobileData: boolean;
}

export interface DownloadsState {
	entries: Record<string, DownloadEntry>;
	/** Last attempt number handed out. */
	seq: number;
}

export const initialDownloads: DownloadsState = { entries: {}, seq: 0 };

export const MESSAGES = {
	offline: "You're offline. Connect to the internet, then try again.",
	onMobileData: "You're on mobile data, and WiFi-only downloads is on.",
	wifiUnknown: "Couldn't confirm this is a WiFi connection, and WiFi-only downloads is on.",
	noSettings: "Could not read your download settings. Please try again.",
	noSpace: "Not enough storage space. Free up space and try again.",
	wifiLost: "Paused: WiFi connection lost. It will resume when WiFi is back.",
} as const;

export interface PartialOnDisk {
	model: ModelInfo;
	totalBytes: number;
	downloadedBytes: number;
}

export type DownloadAction =
	/** Start, resume or retry. */
	| { type: "START"; model: ModelInfo; allowMobileData?: boolean }
	| { type: "CHECK_FAILED"; modelId: string; attempt: number; error: string }
	| { type: "CHECK_BLOCKED_BY_WIFI"; modelId: string; attempt: number; message: string }
	| { type: "CHECKS_PASSED"; modelId: string; attempt: number }
	/** An event from the native download of this attempt. */
	| { type: "NATIVE"; modelId: string; attempt: number; event: DownloadEvent }
	/** The native call rejected (after, or instead of, a Failed event). */
	| { type: "REJECTED"; modelId: string; attempt: number; error: string }
	| { type: "PAUSE"; modelId: string }
	/** WiFi is gone and the WiFi-only rule is on. */
	| { type: "WIFI_LOST" }
	| { type: "WIFI_BACK" }
	/** Stop and forget (the provider deletes the partial file). */
	| { type: "CANCEL"; modelId: string }
	/** Forget a finished or failed entry without touching files. */
	| { type: "REMOVE"; modelId: string }
	/** Partial files found on disk at launch. */
	| { type: "RESTORE"; partials: PartialOnDisk[] };

/** A native transfer is (or may be) running for this phase. */
export function isNativeRunning(phase: DownloadPhase): boolean {
	return phase.kind === "downloading" || phase.kind === "verifying" || phase.kind === "pausing";
}

/** Waiting for WiFi to come back to resume on its own. */
export function awaitsWifi(phase: DownloadPhase): boolean {
	return (
		(phase.kind === "paused" && phase.reason === "wifi-lost") ||
		(phase.kind === "pausing" && phase.reason === "wifi-lost")
	);
}

function put(state: DownloadsState, entry: DownloadEntry): DownloadsState {
	return { ...state, entries: { ...state.entries, [entry.model.id]: entry } };
}

function drop(state: DownloadsState, modelId: string): DownloadsState {
	if (!state.entries[modelId]) return state;
	const entries = { ...state.entries };
	delete entries[modelId];
	return { ...state, entries };
}

/** A fresh attempt for an entry: back to the checks, with a new number. */
function restart(state: DownloadsState, entry: DownloadEntry): DownloadsState {
	const attempt = state.seq + 1;
	return put({ ...state, seq: attempt }, { ...entry, attempt, phase: { kind: "checking" }, speedBps: 0 });
}

/** The entry this action is about, if it still belongs to `attempt`. */
function current(state: DownloadsState, modelId: string, attempt: number): DownloadEntry | null {
	const entry = state.entries[modelId];
	return entry && entry.attempt === attempt ? entry : null;
}

function onNative(state: DownloadsState, entry: DownloadEntry, event: DownloadEvent): DownloadsState {
	const { phase } = entry;
	switch (event.event) {
		case "Started":
			return put(state, {
				...entry,
				totalBytes: event.data.total_bytes,
				// A pause asked for before the transfer began still stands.
				phase: phase.kind === "pausing" ? phase : { kind: "downloading" },
			});
		case "Progress":
			return put(state, {
				...entry,
				downloadedBytes: event.data.bytes_downloaded,
				totalBytes: event.data.total_bytes,
				speedBps: event.data.speed_bps,
				phase: phase.kind === "pausing" ? phase : { kind: "downloading" },
			});
		case "Verifying":
			return put(state, {
				...entry,
				speedBps: 0,
				phase: phase.kind === "pausing" ? phase : { kind: "verifying" },
			});
		case "Finished":
			return put(state, { ...entry, speedBps: 0, allowMobileData: false, phase: { kind: "finished" } });
		case "Failed":
			// Lost WiFi broke the transfer: it still resumes when WiFi is back,
			// as the user was told.
			if (phase.kind === "pausing" && phase.reason === "wifi-lost") {
				return put(state, { ...entry, speedBps: 0, phase: { kind: "paused", reason: "wifi-lost", message: MESSAGES.wifiLost } });
			}
			return put(state, { ...entry, speedBps: 0, phase: { kind: "failed", error: event.data.error } });
		case "Cancelled": {
			const stopped = { ...entry, speedBps: 0 };
			if (phase.kind === "pausing") {
				if (phase.resume) return restart(state, stopped);
				return put(state, {
					...stopped,
					phase:
						phase.reason === "wifi-lost"
							? { kind: "paused", reason: "wifi-lost", message: MESSAGES.wifiLost }
							: { kind: "paused", reason: "user" },
				});
			}
			// Stopped by something other than us (e.g. a reload paused an orphan).
			return put(state, { ...stopped, phase: { kind: "paused", reason: "interrupted" } });
		}
	}
}

export function downloadsReducer(state: DownloadsState, action: DownloadAction): DownloadsState {
	switch (action.type) {
		case "START": {
			const prev = state.entries[action.model.id];
			const allowMobileData = (prev?.allowMobileData ?? false) || !!action.allowMobileData;
			if (prev) {
				switch (prev.phase.kind) {
					case "checking":
					case "downloading":
					case "verifying":
						// Already on its way. A late "use this connection" still counts.
						return allowMobileData === prev.allowMobileData ? state : put(state, { ...prev, allowMobileData });
					case "pausing":
						// The transfer is still stopping: start again once it has.
						return put(state, { ...prev, allowMobileData, phase: { ...prev.phase, resume: true } });
				}
			}
			return restart(state, {
				model: action.model,
				attempt: 0,
				phase: { kind: "checking" },
				totalBytes: prev?.totalBytes ?? action.model.size_bytes,
				downloadedBytes: prev?.downloadedBytes ?? 0,
				speedBps: 0,
				allowMobileData,
			});
		}

		case "CHECK_FAILED": {
			const entry = current(state, action.modelId, action.attempt);
			if (entry?.phase.kind !== "checking") return state;
			return put(state, { ...entry, phase: { kind: "failed", error: action.error } });
		}

		case "CHECK_BLOCKED_BY_WIFI": {
			const entry = current(state, action.modelId, action.attempt);
			if (entry?.phase.kind !== "checking") return state;
			return put(state, { ...entry, phase: { kind: "paused", reason: "wifi-blocked", message: action.message } });
		}

		case "CHECKS_PASSED": {
			const entry = current(state, action.modelId, action.attempt);
			if (entry?.phase.kind !== "checking") return state;
			return put(state, { ...entry, phase: { kind: "downloading" } });
		}

		case "NATIVE": {
			const entry = current(state, action.modelId, action.attempt);
			if (!entry || !isNativeRunning(entry.phase)) return state;
			return onNative(state, entry, action.event);
		}

		case "REJECTED": {
			const entry = current(state, action.modelId, action.attempt);
			// A Failed event may already have said why; keep the specific reason.
			if (!entry || !isNativeRunning(entry.phase)) return state;
			return put(state, { ...entry, speedBps: 0, phase: { kind: "failed", error: action.error } });
		}

		case "PAUSE": {
			const entry = state.entries[action.modelId];
			if (!entry) return state;
			switch (entry.phase.kind) {
				case "checking":
					// Nothing native yet: stop the checks by moving to a new attempt.
					return put({ ...state, seq: state.seq + 1 }, {
						...entry,
						attempt: state.seq + 1,
						phase: { kind: "paused", reason: "user" },
					});
				case "downloading":
				case "verifying":
					return put(state, { ...entry, phase: { kind: "pausing", reason: "user", resume: false } });
				case "pausing":
					// The user's pause wins over an automatic one, and cancels a queued resume.
					return put(state, { ...entry, phase: { kind: "pausing", reason: "user", resume: false } });
				default:
					return state;
			}
		}

		case "WIFI_LOST": {
			let next = state;
			for (const entry of Object.values(state.entries)) {
				if (entry.allowMobileData) continue;
				if (entry.phase.kind === "downloading" || entry.phase.kind === "verifying") {
					next = put(next, { ...entry, phase: { kind: "pausing", reason: "wifi-lost", resume: false } });
				}
			}
			return next;
		}

		case "WIFI_BACK": {
			let next = state;
			for (const entry of Object.values(state.entries)) {
				const { phase } = entry;
				if (phase.kind === "paused" && phase.reason === "wifi-lost") next = restart(next, entry);
				else if (phase.kind === "pausing" && phase.reason === "wifi-lost" && !phase.resume) {
					next = put(next, { ...entry, phase: { ...phase, resume: true } });
				}
			}
			return next;
		}

		case "CANCEL":
		case "REMOVE":
			return drop(state, action.modelId);

		case "RESTORE": {
			let next = state;
			for (const p of action.partials) {
				if (next.entries[p.model.id]) continue;
				next = put(next, {
					model: p.model,
					attempt: 0,
					phase: { kind: "paused", reason: "interrupted" },
					totalBytes: p.totalBytes,
					downloadedBytes: p.downloadedBytes,
					speedBps: 0,
					allowMobileData: false,
				});
			}
			return next;
		}
	}
}

/* ── The view the rest of the app reads ── */

/** Coarse status shown by the pages. Checking and pausing read as "downloading". */
export type DownloadStatus = "downloading" | "verifying" | "paused" | "finished" | "failed";

export interface DownloadState {
	model: ModelInfo;
	modelId: string;
	modelName: string;
	sizeLabel: string;
	status: DownloadStatus;
	/** The exact phase, for code that needs more than `status`. */
	phase: DownloadPhase;
	totalBytes: number;
	downloadedBytes: number;
	speedBps: number;
	/** Why the download is paused or failed, when there is a reason to show. */
	error?: string;
	/**
	 * True when the only thing stopping the download is the WiFi-only rule.
	 * The UI then offers to go ahead on the current connection.
	 */
	blockedByWifi: boolean;
}

export function statusOf(phase: DownloadPhase): DownloadStatus {
	switch (phase.kind) {
		case "checking":
		case "downloading":
		case "pausing":
			return "downloading";
		default:
			return phase.kind;
	}
}

function messageOf(phase: DownloadPhase): string | undefined {
	switch (phase.kind) {
		case "paused":
			return phase.message;
		case "failed":
			return phase.error;
		case "pausing":
			return phase.reason === "wifi-lost" ? MESSAGES.wifiLost : undefined;
		default:
			return undefined;
	}
}

export function toDownloadState(entry: DownloadEntry): DownloadState {
	const { model, phase } = entry;
	return {
		model,
		modelId: model.id,
		modelName: model.name,
		sizeLabel: model.size_label,
		status: statusOf(phase),
		phase,
		totalBytes: entry.totalBytes,
		downloadedBytes: entry.downloadedBytes,
		speedBps: entry.speedBps,
		error: messageOf(phase),
		blockedByWifi: phase.kind === "paused" && phase.reason === "wifi-blocked",
	};
}

/** Entries that have just entered `checking` and whose checks have not been launched. */
export function toLaunch(state: DownloadsState, launched: ReadonlyMap<string, number>): DownloadEntry[] {
	return Object.values(state.entries).filter(
		(e) => e.phase.kind === "checking" && launched.get(e.model.id) !== e.attempt,
	);
}
