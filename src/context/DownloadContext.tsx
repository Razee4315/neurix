import { modelService, notificationService, settingsService } from "@/services";
import { keepAliveForDownload, releaseDownloadKeepAlive } from "@/services/androidBridge";
import type { DownloadEvent, ModelInfo } from "@/services/types";
import { isMobile } from "@/utils/platform";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
	type DownloadAction,
	type DownloadState,
	type DownloadsState,
	MESSAGES,
	awaitsWifi,
	downloadsReducer,
	initialDownloads,
	isNativeRunning,
	toDownloadState,
	toLaunch,
} from "./downloadMachine";

export type { DownloadPhase, DownloadState, DownloadStatus, PauseReason } from "./downloadMachine";

// Network detection (mobile only). Deliberately fail-closed: if we cannot
// prove the user is on WiFi we treat it as "not WiFi" and block, so a
// download never silently burns mobile data.
//
//   isWifi: true  -> confirmed WiFi/ethernet, allow download
//   isWifi: false -> confirmed cellular OR offline, block
//   isWifi: null  -> unknown; blocked when wifi_only is enabled
//
// Desktop WebViews do not report a connection type at all and have no
// metered-data concept here, so desktop is always treated as unmetered.
function detectNetwork(): boolean | null {
	if (!navigator.onLine) return false;
	if (!isMobile()) return true;

	const conn = (navigator as Navigator & { connection?: { type?: string } }).connection;
	if (!conn?.type) return null;
	if (conn.type === "wifi" || conn.type === "ethernet" || conn.type === "wimax") return true;
	if (conn.type === "cellular") return false;
	// "unknown", "other", "none", "bluetooth": fail-closed.
	return null;
}

const isOnWifi = () => detectNetwork() === true;

export interface StartOptions {
	/** The user chose to download on this connection despite WiFi-only. */
	allowMobileData?: boolean;
}

interface DownloadContextValue {
	downloads: Record<string, DownloadState>;
	/**
	 * Increments whenever the set of installed models may have changed (a
	 * download finished, or one was discarded). Pages refetch on this rather
	 * than on every progress tick.
	 */
	installedVersion: number;
	startDownload: (model: ModelInfo, options?: StartOptions) => void;
	pauseDownload: (modelId: string) => void;
	resumeDownload: (model: ModelInfo, options?: StartOptions) => void;
	/** Stop and delete the partial file. */
	cancelDownload: (modelId: string) => void;
	/** Forget a finished/failed entry without touching files. */
	removeDownload: (modelId: string) => void;
}

const DownloadContext = createContext<DownloadContextValue>({
	downloads: {},
	installedVersion: 0,
	startDownload: () => {},
	pauseDownload: () => {},
	resumeDownload: () => {},
	cancelDownload: () => {},
	removeDownload: () => {},
});

/**
 * Owns every model download. The states and transitions live in
 * `downloadMachine.ts`; this provider only performs the side effects the
 * machine asks for (pre-flight checks, native calls, notifications).
 */
export function DownloadProvider({ children }: { children: React.ReactNode }) {
	// The machine's state, readable synchronously by long-lived callbacks.
	const machineRef = useRef<DownloadsState>(initialDownloads);
	const [machine, setMachine] = useState<DownloadsState>(initialDownloads);
	const [installedVersion, setInstalledVersion] = useState(0);
	// Attempt last launched per model, so each attempt's checks run once.
	const launchedRef = useRef<Map<string, number>>(new Map());

	const dispatch = useCallback((action: DownloadAction) => {
		const next = downloadsReducer(machineRef.current, action);
		if (next !== machineRef.current) {
			machineRef.current = next;
			setMachine(next);
		}
		return next;
	}, []);

	const bumpInstalled = useCallback(() => setInstalledVersion((v) => v + 1), []);

	/** Pre-flight checks, then the native download, for one attempt. */
	const launch = useCallback(
		async (modelId: string, attempt: number) => {
			const entry = () => machineRef.current.entries[modelId];
			// Still this attempt, still checking: a pause or cancel ends the checks.
			const stillChecking = () => entry()?.attempt === attempt && entry()?.phase.kind === "checking";
			const model = entry()?.model;
			if (!model || !stillChecking()) return;

			if (!navigator.onLine) {
				dispatch({ type: "CHECK_FAILED", modelId, attempt, error: MESSAGES.offline });
				return;
			}

			// Enforce WiFi-only. Fail-closed: proceed only on CONFIRMED WiFi.
			let wifiOnly: boolean;
			try {
				wifiOnly = (await settingsService.getSettings()).wifi_only;
			} catch {
				dispatch({ type: "CHECK_FAILED", modelId, attempt, error: MESSAGES.noSettings });
				return;
			}
			if (!stillChecking()) return;
			if (wifiOnly && !entry()?.allowMobileData) {
				const wifi = detectNetwork();
				if (wifi !== true) {
					const message = wifi === false ? MESSAGES.onMobileData : MESSAGES.wifiUnknown;
					dispatch({ type: "CHECK_BLOCKED_BY_WIFI", modelId, attempt, message });
					return;
				}
			}

			try {
				if (!(await settingsService.checkAvailableSpace(model.size_bytes))) {
					dispatch({ type: "CHECK_FAILED", modelId, attempt, error: MESSAGES.noSpace });
					return;
				}
			} catch {
				// Space check unavailable: let the download itself report a full disk.
			}
			if (!stillChecking()) return;
			dispatch({ type: "CHECKS_PASSED", modelId, attempt });

			// Set once this run's native download has been told to stop because
			// its entry was cancelled while it was starting up.
			let orphanStopped = false;
			const handleEvent = (event: DownloadEvent) => {
				const current = entry();
				if (current?.attempt !== attempt) {
					// Cancelled while the native side was starting: stop it and
					// drop its bytes, so nothing downloads without a screen for it.
					if (!current && !orphanStopped) {
						orphanStopped = true;
						modelService.discardDownload(modelId).catch(() => {});
					}
					return;
				}
				dispatch({ type: "NATIVE", modelId, attempt, event });
				switch (event.event) {
					case "Progress": {
						const { bytes_downloaded, total_bytes } = event.data;
						if (total_bytes > 0) {
							notificationService.notifyDownloadProgress(model.name, (bytes_downloaded / total_bytes) * 100);
						}
						break;
					}
					case "Finished":
						bumpInstalled();
						notificationService.notifyDownloadComplete(model.name);
						break;
					case "Failed":
						notificationService.notifyDownloadFailed(model.name, event.data.error);
						break;
					case "Cancelled":
						notificationService.clearDownloadNotification();
						break;
				}
			};

			// The backend re-checks the WiFi rule. An explicit "use this
			// connection" from the user counts as confirmation.
			const confirmed = isOnWifi() || !!entry()?.allowMobileData;
			modelService.downloadModel(modelId, confirmed, handleEvent).catch((err) => {
				dispatch({ type: "REJECTED", modelId, attempt, error: String(err) });
			});
		},
		[dispatch, bumpInstalled],
	);

	// Whatever has just entered `checking` gets its checks run, once. The
	// machine alone decides when a download (re)starts: a user start, a
	// resume queued behind a pause, or WiFi coming back.
	useEffect(() => {
		for (const entry of toLaunch(machine, launchedRef.current)) {
			launchedRef.current.set(entry.model.id, entry.attempt);
			void launch(entry.model.id, entry.attempt);
		}
	}, [machine, launch]);

	const startDownload = useCallback(
		(model: ModelInfo, options?: StartOptions) => {
			dispatch({ type: "START", model, allowMobileData: options?.allowMobileData });
		},
		[dispatch],
	);

	const pauseDownload = useCallback(
		(modelId: string) => {
			const before = machineRef.current.entries[modelId];
			const after = dispatch({ type: "PAUSE", modelId }).entries[modelId];
			// Only a running transfer needs telling; paused checks just stop.
			if (before && isNativeRunning(before.phase) && before.phase.kind !== "pausing" && after?.phase.kind === "pausing") {
				modelService.pauseDownload(modelId).catch(() => {});
			}
			// Status flips to "paused" when the Cancelled event arrives.
		},
		[dispatch],
	);

	const cancelDownload = useCallback(
		(modelId: string) => {
			dispatch({ type: "CANCEL", modelId });
			notificationService.clearDownloadNotification();
			modelService.discardDownload(modelId).catch(() => {}).finally(bumpInstalled);
		},
		[dispatch, bumpInstalled],
	);

	const removeDownload = useCallback(
		(modelId: string) => {
			dispatch({ type: "REMOVE", modelId });
		},
		[dispatch],
	);

	// Restore downloads interrupted in an earlier session (or by a reload of
	// the WebView) as paused entries, so they can be resumed or discarded
	// instead of silently holding storage.
	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				// A native download that outlived the WebView has no listener
				// any more: pause it so its bytes are kept and it shows below.
				const orphaned = await modelService.getActiveDownloads();
				await Promise.all(orphaned.map((id) => modelService.pauseDownload(id).catch(() => {})));

				const [partials, catalog] = await Promise.all([
					modelService.getPartialDownloads(),
					modelService.getCatalog(),
				]);
				if (cancelled) return;
				dispatch({
					type: "RESTORE",
					partials: partials.flatMap((p) => {
						const model = catalog.find((m) => m.id === p.id);
						return model ? [{ model, totalBytes: p.total_bytes, downloadedBytes: p.downloaded_bytes }] : [];
					}),
				});
			} catch {
				// Nothing to restore, or the backend is unavailable.
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [dispatch]);

	// Pause downloads when WiFi is lost and resume them when it returns.
	//
	// Android WebViews don't reliably fire navigator.connection 'change', so
	// this also polls — but only while there is something to watch.
	useEffect(() => {
		if (!isMobile()) return;
		const conn = (navigator as Navigator & { connection?: EventTarget }).connection;

		const handleNetworkChange = async () => {
			const watching = Object.values(machineRef.current.entries).some(
				(e) => isNativeRunning(e.phase) || awaitsWifi(e.phase),
			);
			if (!watching) return;
			let wifiOnly = false;
			try {
				wifiOnly = (await settingsService.getSettings()).wifi_only;
			} catch {
				return;
			}
			if (!wifiOnly) return;

			if (isOnWifi()) {
				// Resumes are launched by the effect above.
				dispatch({ type: "WIFI_BACK" });
				return;
			}
			const before = machineRef.current.entries;
			const after = dispatch({ type: "WIFI_LOST" }).entries;
			for (const [modelId, entry] of Object.entries(after)) {
				if (entry.phase.kind === "pausing" && before[modelId]?.phase.kind !== "pausing") {
					modelService.pauseDownload(modelId).catch(() => {});
				}
			}
		};

		conn?.addEventListener("change", handleNetworkChange);
		window.addEventListener("offline", handleNetworkChange);
		window.addEventListener("online", handleNetworkChange);
		const pollId = window.setInterval(handleNetworkChange, 8000);

		return () => {
			conn?.removeEventListener("change", handleNetworkChange);
			window.removeEventListener("offline", handleNetworkChange);
			window.removeEventListener("online", handleNetworkChange);
			window.clearInterval(pollId);
		};
	}, [dispatch]);

	const downloads = useMemo(() => {
		const view: Record<string, DownloadState> = {};
		for (const [id, entry] of Object.entries(machine.entries)) view[id] = toDownloadState(entry);
		return view;
	}, [machine]);

	// Keep the app alive in the background for as long as something is
	// actually transferring (Android only; a no-op elsewhere).
	const transferring = Object.values(downloads).find(
		(d) => d.status === "downloading" || d.status === "verifying",
	);
	const transferringName = transferring?.modelName ?? null;
	useEffect(() => {
		if (transferringName) keepAliveForDownload(transferringName);
		else releaseDownloadKeepAlive();
	}, [transferringName]);

	const value = useMemo<DownloadContextValue>(
		() => ({
			downloads,
			installedVersion,
			startDownload,
			pauseDownload,
			// Resuming is starting again: the partial file is picked up where it stopped.
			resumeDownload: startDownload,
			cancelDownload,
			removeDownload,
		}),
		[downloads, installedVersion, startDownload, pauseDownload, cancelDownload, removeDownload],
	);

	return <DownloadContext.Provider value={value}>{children}</DownloadContext.Provider>;
}

export function useDownloads() {
	return useContext(DownloadContext);
}
