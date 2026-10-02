import { modelService, notificationService, settingsService } from "@/services";
import type { DownloadEvent, ModelInfo } from "@/services/types";
import { isMobile } from "@/utils/platform";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

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

export type DownloadStatus =
	| "downloading"
	| "verifying"
	| "paused"
	| "finished"
	| "failed";

export interface DownloadState {
	model: ModelInfo;
	modelId: string;
	modelName: string;
	sizeLabel: string;
	status: DownloadStatus;
	totalBytes: number;
	downloadedBytes: number;
	speedBps: number;
	/** Why the download is paused or failed, when there is a reason to show. */
	error?: string;
}

interface DownloadContextValue {
	downloads: Record<string, DownloadState>;
	/**
	 * Increments whenever the set of installed models may have changed (a
	 * download finished, or one was discarded). Pages refetch on this rather
	 * than on every progress tick.
	 */
	installedVersion: number;
	startDownload: (model: ModelInfo) => void;
	pauseDownload: (modelId: string) => void;
	resumeDownload: (model: ModelInfo) => void;
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

export function DownloadProvider({ children }: { children: React.ReactNode }) {
	const [downloads, setDownloads] = useState<Record<string, DownloadState>>({});
	const [installedVersion, setInstalledVersion] = useState(0);
	// Model IDs with an in-flight native download.
	const activeRef = useRef<Set<string>>(new Set());
	// Model IDs still running their async pre-checks.
	const startingRef = useRef<Set<string>>(new Set());
	// Downloads WE paused because WiFi dropped, so they can auto-resume when
	// it returns. Cleared on user pause/cancel so we never fight the user.
	const autoPausedRef = useRef<Map<string, ModelInfo>>(new Map());

	const updateDownload = useCallback((modelId: string, patch: Partial<DownloadState>) => {
		setDownloads((prev) => {
			const existing = prev[modelId];
			if (!existing) return prev;
			return { ...prev, [modelId]: { ...existing, ...patch } };
		});
	}, []);

	const bumpInstalled = useCallback(() => setInstalledVersion((v) => v + 1), []);

	const startDownload = useCallback((model: ModelInfo) => {
		if (activeRef.current.has(model.id) || startingRef.current.has(model.id)) return;
		startingRef.current.add(model.id);
		autoPausedRef.current.delete(model.id);

		setDownloads((prev) => ({
			...prev,
			[model.id]: {
				model,
				modelId: model.id,
				modelName: model.name,
				sizeLabel: model.size_label,
				status: "downloading",
				totalBytes: prev[model.id]?.totalBytes ?? model.size_bytes,
				downloadedBytes: prev[model.id]?.downloadedBytes ?? 0,
				speedBps: 0,
			},
		}));

		(async () => {
			// Enforce WiFi-only. Fail-closed: proceed only on CONFIRMED WiFi.
			try {
				const current = await settingsService.getSettings();
				if (current.wifi_only) {
					const wifi = detectNetwork();
					if (wifi !== true) {
						startingRef.current.delete(model.id);
						updateDownload(model.id, {
							status: "paused",
							error: wifi === false
								? "You're on mobile data. Connect to WiFi, or turn off WiFi-only downloads in Settings."
								: "Couldn't confirm a WiFi connection. Connect to WiFi, or turn off WiFi-only downloads in Settings.",
						});
						return;
					}
				}
			} catch {
				startingRef.current.delete(model.id);
				updateDownload(model.id, {
					status: "failed",
					error: "Could not read your download settings. Please try again.",
				});
				return;
			}

			try {
				const remaining = model.size_bytes;
				if (!(await settingsService.checkAvailableSpace(remaining))) {
					startingRef.current.delete(model.id);
					updateDownload(model.id, {
						status: "failed",
						error: "Not enough storage space. Free up space and try again.",
					});
					return;
				}
			} catch {
				// Space check unavailable: let the download itself report a full disk.
			}

			activeRef.current.add(model.id);
			startingRef.current.delete(model.id);

			const handleEvent = (event: DownloadEvent) => {
				switch (event.event) {
					case "Started":
						updateDownload(model.id, {
							totalBytes: event.data.total_bytes,
							status: "downloading",
							error: undefined,
						});
						break;
					case "Progress": {
						const { bytes_downloaded, total_bytes, speed_bps } = event.data;
						updateDownload(model.id, {
							downloadedBytes: bytes_downloaded,
							totalBytes: total_bytes,
							speedBps: speed_bps,
							status: "downloading",
						});
						if (total_bytes > 0) {
							notificationService.notifyDownloadProgress(
								model.name,
								(bytes_downloaded / total_bytes) * 100,
							);
						}
						break;
					}
					case "Verifying":
						updateDownload(model.id, { status: "verifying", speedBps: 0 });
						break;
					case "Finished":
						activeRef.current.delete(model.id);
						updateDownload(model.id, { status: "finished", speedBps: 0, error: undefined });
						bumpInstalled();
						notificationService.notifyDownloadComplete(model.name);
						break;
					case "Failed":
						activeRef.current.delete(model.id);
						updateDownload(model.id, {
							status: "failed",
							speedBps: 0,
							error: event.data.error,
						});
						notificationService.notifyDownloadFailed(model.name, event.data.error);
						break;
					case "Cancelled":
						activeRef.current.delete(model.id);
						// Keeps any reason already set (e.g. "WiFi connection lost").
						updateDownload(model.id, { status: "paused", speedBps: 0 });
						notificationService.clearDownloadNotification();
						break;
				}
			};

			modelService.downloadModel(model.id, isOnWifi(), handleEvent).catch((err) => {
				activeRef.current.delete(model.id);
				// A "Failed" event may already have set the message; don't replace
				// a specific reason with the generic rejection text.
				setDownloads((prev) => {
					const existing = prev[model.id];
					if (!existing || existing.status === "failed") return prev;
					return {
						...prev,
						[model.id]: { ...existing, status: "failed", speedBps: 0, error: String(err) },
					};
				});
			});
		})();
	}, [updateDownload, bumpInstalled]);

	const pauseDownload = useCallback((modelId: string) => {
		if (!activeRef.current.has(modelId)) return;
		autoPausedRef.current.delete(modelId);
		updateDownload(modelId, { error: undefined });
		modelService.pauseDownload(modelId).catch(() => {});
		// Status flips to "paused" when the Cancelled event arrives.
	}, [updateDownload]);

	const resumeDownload = useCallback((model: ModelInfo) => {
		startDownload(model);
	}, [startDownload]);

	const cancelDownload = useCallback((modelId: string) => {
		activeRef.current.delete(modelId);
		startingRef.current.delete(modelId);
		autoPausedRef.current.delete(modelId);
		notificationService.clearDownloadNotification();
		setDownloads((prev) => {
			const next = { ...prev };
			delete next[modelId];
			return next;
		});
		modelService.discardDownload(modelId).catch(() => {}).finally(bumpInstalled);
	}, [bumpInstalled]);

	const removeDownload = useCallback((modelId: string) => {
		setDownloads((prev) => {
			const next = { ...prev };
			delete next[modelId];
			return next;
		});
	}, []);

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
				setDownloads((prev) => {
					const next = { ...prev };
					for (const p of partials) {
						const model = catalog.find((m) => m.id === p.id);
						if (!model || next[p.id]) continue;
						next[p.id] = {
							model,
							modelId: p.id,
							modelName: p.name,
							sizeLabel: p.size_label,
							status: "paused",
							totalBytes: p.total_bytes,
							downloadedBytes: p.downloaded_bytes,
							speedBps: 0,
						};
					}
					return next;
				});
			} catch {
				// Nothing to restore, or the backend is unavailable.
			}
		})();
		return () => { cancelled = true; };
	}, []);

	// Pause downloads when WiFi is lost and resume them when it returns.
	//
	// Android WebViews don't reliably fire navigator.connection 'change', so
	// this also polls — but only while there is something to watch.
	useEffect(() => {
		if (!isMobile()) return;
		const conn = (navigator as Navigator & { connection?: EventTarget }).connection;

		const handleNetworkChange = async () => {
			if (activeRef.current.size === 0 && autoPausedRef.current.size === 0) return;
			let wifiOnly = false;
			try {
				wifiOnly = (await settingsService.getSettings()).wifi_only;
			} catch {
				return;
			}
			if (!wifiOnly) return;

			if (!isOnWifi()) {
				for (const modelId of Array.from(activeRef.current)) {
					setDownloads((prev) => {
						const existing = prev[modelId];
						if (!existing) return prev;
						autoPausedRef.current.set(modelId, existing.model);
						return {
							...prev,
							[modelId]: { ...existing, error: "Paused: WiFi connection lost. It will resume when WiFi is back." },
						};
					});
					modelService.pauseDownload(modelId).catch(() => {});
				}
				return;
			}

			if (autoPausedRef.current.size > 0) {
				const toResume = Array.from(autoPausedRef.current.values());
				autoPausedRef.current.clear();
				for (const model of toResume) startDownload(model);
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
	}, [startDownload]);

	const value = useMemo<DownloadContextValue>(
		() => ({
			downloads,
			installedVersion,
			startDownload,
			pauseDownload,
			resumeDownload,
			cancelDownload,
			removeDownload,
		}),
		[downloads, installedVersion, startDownload, pauseDownload, resumeDownload, cancelDownload, removeDownload],
	);

	return <DownloadContext.Provider value={value}>{children}</DownloadContext.Provider>;
}

export function useDownloads() {
	return useContext(DownloadContext);
}
