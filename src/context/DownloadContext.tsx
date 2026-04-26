import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { modelService, settingsService, notificationService } from "@/services";
import type { DownloadEvent, ModelInfo, Settings } from "@/services/types";

// Network detection. We are deliberately fail-closed: if we can't prove the
// user is on WiFi (or ethernet), we treat it as "not WiFi" and block the
// download. The previous implementation was fail-open and let downloads
// proceed any time conn.type was 'unknown' — common on Android WebViews —
// which silently consumed user mobile data.
//
// Returns:
//   isWifi: true  -> confirmed WiFi/ethernet, allow download
//   isWifi: false -> confirmed cellular OR offline, block
//   isWifi: null  -> unknown — caller must treat this as a block when
//                    wifi_only is enabled
function detectNetwork(): { isWifi: boolean | null; apiAvailable: boolean } {
	// Offline = definitely not on WiFi.
	if (!navigator.onLine) return { isWifi: false, apiAvailable: true };

	const nav = navigator as Navigator & {
		connection?: { type?: string; effectiveType?: string };
	};
	const conn = nav.connection;

	// API unavailable: cannot determine. Fail-closed.
	if (!conn || !conn.type) return { isWifi: null, apiAvailable: false };

	// Allow-list: only confirmed wired/wireless LAN counts as "WiFi".
	if (conn.type === "wifi" || conn.type === "ethernet" || conn.type === "wimax") {
		return { isWifi: true, apiAvailable: true };
	}
	// Confirmed cellular -> block.
	if (conn.type === "cellular") {
		return { isWifi: false, apiAvailable: true };
	}
	// Anything else ("unknown", "other", "none", "bluetooth"): fail-closed.
	return { isWifi: null, apiAvailable: true };
}

// Returns true if we are confidently on a non-metered network. Used to gate
// downloads when wifi_only is enabled. Treats unknown as not-WiFi.
function isOnWifi(): boolean {
	return detectNetwork().isWifi === true;
}

export interface DownloadState {
	modelId: string;
	modelName: string;
	sizeLabel: string;
	status: "downloading" | "paused" | "finished" | "failed" | "cancelled";
	totalBytes: number;
	downloadedBytes: number;
	speedBps: number;
	error?: string;
}

interface DownloadContextValue {
	downloads: Record<string, DownloadState>;
	startDownload: (model: ModelInfo) => void;
	pauseDownload: (modelId: string) => void;
	resumeDownload: (model: ModelInfo) => void;
	cancelDownload: (modelId: string) => void;
	removeDownload: (modelId: string) => void;
}

const DownloadContext = createContext<DownloadContextValue>({
	downloads: {},
	startDownload: () => {},
	pauseDownload: () => {},
	resumeDownload: () => {},
	cancelDownload: () => {},
	removeDownload: () => {},
});

export function DownloadProvider({ children }: { children: React.ReactNode }) {
	const [downloads, setDownloads] = useState<Record<string, DownloadState>>({});
	// Tracks model IDs that have an active invoke call (download in progress on Rust side)
	const activeRef = useRef<Set<string>>(new Set());
	// Tracks model IDs that are in the process of starting (async pre-checks)
	const startingRef = useRef<Set<string>>(new Set());

	const updateDownload = useCallback((modelId: string, patch: Partial<DownloadState>) => {
		setDownloads((prev) => {
			const existing = prev[modelId];
			if (!existing) return prev;
			return { ...prev, [modelId]: { ...existing, ...patch } };
		});
	}, []);

	const startDownload = useCallback((model: ModelInfo) => {
		// Guard: don't start if already downloading or already starting
		if (activeRef.current.has(model.id) || startingRef.current.has(model.id)) return;
		startingRef.current.add(model.id);

		// Set UI state immediately (synchronous)
		setDownloads((prev) => ({
			...prev,
			[model.id]: {
				modelId: model.id,
				modelName: model.name,
				sizeLabel: model.size_label,
				status: "downloading",
				totalBytes: model.size_bytes,
				downloadedBytes: prev[model.id]?.downloadedBytes ?? 0,
				speedBps: 0,
			},
		}));

		// Run async pre-checks then start the actual download
		(async () => {
			// Enforce WiFi-only setting. Fail-closed: only proceed when we can
			// CONFIRM WiFi. If detection is uncertain we block and tell the user.
			try {
				const currentSettings: Settings = await settingsService.getSettings();
				if (currentSettings.wifi_only) {
					const network = detectNetwork();
					if (network.isWifi !== true) {
						startingRef.current.delete(model.id);
						const reason = network.isWifi === false
							? "Mobile data detected. Connect to WiFi to download."
							: "Could not confirm WiFi connection. Connect to a known WiFi network, or turn off WiFi-only in Settings.";
						updateDownload(model.id, { status: "paused", error: reason });
						return;
					}
				}
			} catch {
				// If settings check fails, fail-closed: don't proceed
				startingRef.current.delete(model.id);
				updateDownload(model.id, {
					status: "failed",
					error: "Could not verify network settings. Please try again.",
				});
				return;
			}

			// Check available disk space
			try {
				const hasSpace = await settingsService.checkAvailableSpace(model.size_bytes);
				if (!hasSpace) {
					startingRef.current.delete(model.id);
					updateDownload(model.id, {
						status: "failed",
						error: "Not enough storage space. Free up space and try again.",
					});
					return;
				}
			} catch {
				// If space check fails, proceed anyway
			}

			// Mark as active (Rust invoke is about to start)
			activeRef.current.add(model.id);
			startingRef.current.delete(model.id);

			const handleEvent = (event: DownloadEvent) => {
				switch (event.event) {
					case "Started":
						if (event.data && "total_bytes" in event.data) {
							updateDownload(model.id, {
								totalBytes: event.data.total_bytes,
								status: "downloading",
							});
						}
						break;
					case "Progress":
						if (event.data && "bytes_downloaded" in event.data) {
							updateDownload(model.id, {
								downloadedBytes: event.data.bytes_downloaded,
								totalBytes: event.data.total_bytes,
								speedBps: event.data.speed_bps,
								status: "downloading",
							});
						}
						break;
					case "Finished":
						updateDownload(model.id, { status: "finished", speedBps: 0 });
						activeRef.current.delete(model.id);
						notificationService.notifyDownloadComplete(model.name);
						break;
					case "Failed": {
						const errMsg = event.data && "error" in event.data ? event.data.error : "Unknown error";
						updateDownload(model.id, {
							status: "failed",
							speedBps: 0,
							error: errMsg,
						});
						activeRef.current.delete(model.id);
						notificationService.notifyDownloadFailed(model.name, errMsg);
						break;
					}
					case "Cancelled":
						// Preserve existing error message (e.g., from WiFi disconnect)
						setDownloads((prev) => {
							const existing = prev[model.id];
							if (!existing) return prev;
							return {
								...prev,
								[model.id]: {
									...existing,
									status: "paused",
									speedBps: 0,
									// Keep existing error if set, otherwise clear it
									error: existing.error || undefined,
								},
							};
						});
						activeRef.current.delete(model.id);
						notificationService.clearDownloadNotification();
						break;
				}
			};

			// Pass our local network reading to the backend so it can refuse
			// the download if WiFi-only is on but we couldn't confirm WiFi.
			modelService.downloadModel(model.id, isOnWifi(), handleEvent).catch((err) => {
				updateDownload(model.id, { status: "failed", error: String(err) });
				activeRef.current.delete(model.id);
				notificationService.notifyDownloadFailed(model.name, String(err));
			});
		})();
	}, [updateDownload]);

	const pauseDownload = useCallback((modelId: string) => {
		if (!activeRef.current.has(modelId)) return; // Nothing to pause
		modelService.cancelDownload(modelId);
		// Status will be set to "paused" when Cancelled event arrives
	}, []);

	const resumeDownload = useCallback((model: ModelInfo) => {
		if (activeRef.current.has(model.id) || startingRef.current.has(model.id)) return;
		// Always check WiFi on resume - user's data protection takes priority
		startDownload(model);
	}, [startDownload]);

	const cancelDownload = useCallback((modelId: string) => {
		modelService.cancelDownload(modelId);
		activeRef.current.delete(modelId);
		startingRef.current.delete(modelId);
		notificationService.clearDownloadNotification();
		setDownloads((prev) => {
			const next = { ...prev };
			delete next[modelId];
			return next;
		});
	}, []);

	const removeDownload = useCallback((modelId: string) => {
		setDownloads((prev) => {
			const next = { ...prev };
			delete next[modelId];
			return next;
		});
	}, []);

	// Monitor network changes and pause downloads when WiFi is lost.
	//
	// Android WebViews don't reliably fire navigator.connection 'change'
	// events, so we also poll every 8s while a download is active. The poll
	// is short-circuited when there are no active downloads.
	useEffect(() => {
		const nav = navigator as Navigator & {
			connection?: EventTarget & { type?: string };
		};
		const conn = nav.connection;

		const pauseAllActive = (reason: string) => {
			if (activeRef.current.size === 0) return;
			for (const modelId of activeRef.current) {
				modelService.cancelDownload(modelId);
				setDownloads((prev) => {
					const existing = prev[modelId];
					if (!existing) return prev;
					return {
						...prev,
						[modelId]: {
							...existing,
							status: "paused",
							speedBps: 0,
							error: reason,
						},
					};
				});
			}
			activeRef.current.clear();
		};

		const handleNetworkChange = async () => {
			if (activeRef.current.size === 0) return;
			try {
				const settings = await settingsService.getSettings();
				if (!settings.wifi_only) return;
			} catch {
				return;
			}
			// Fail-closed: pause if we are NOT confirmed on WiFi. This catches
			// both 'cellular' and 'unknown'/'none', which the old code missed.
			if (!isOnWifi()) {
				pauseAllActive("Download paused: WiFi connection lost");
			}
		};

		if (conn) conn.addEventListener("change", handleNetworkChange);
		window.addEventListener("offline", handleNetworkChange);

		// Polling fallback for Android WebViews where 'change' doesn't fire.
		const pollId = window.setInterval(handleNetworkChange, 8000);

		return () => {
			if (conn) conn.removeEventListener("change", handleNetworkChange);
			window.removeEventListener("offline", handleNetworkChange);
			window.clearInterval(pollId);
		};
	}, []);

	return (
		<DownloadContext.Provider
			value={{ downloads, startDownload, pauseDownload, resumeDownload, cancelDownload, removeDownload }}
		>
			{children}
		</DownloadContext.Provider>
	);
}

export function useDownloads() {
	return useContext(DownloadContext);
}
