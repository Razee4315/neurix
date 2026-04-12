import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { modelService, settingsService, notificationService } from "@/services";
import type { DownloadEvent, ModelInfo, Settings } from "@/services/types";

// Network detection result: true = on WiFi, false = on mobile data, null = can't determine
function detectNetwork(): { isWifi: boolean | null; apiAvailable: boolean } {
	// If the browser says we're offline, we're definitely not on WiFi
	if (!navigator.onLine) return { isWifi: false, apiAvailable: true };

	const nav = navigator as Navigator & {
		connection?: { type?: string; effectiveType?: string };
	};
	const conn = nav.connection;

	// If connection API unavailable, we can't determine network type
	if (!conn || !conn.type) return { isWifi: null, apiAvailable: false };

	// Only block on explicitly mobile connections
	// "cellular" is mobile data - block this
	// "wifi", "ethernet", "wimax" - allow
	// "unknown", "other", "none", "bluetooth" - can't be sure, allow to avoid false blocks
	const isMobileData = conn.type === "cellular";
	return { isWifi: !isMobileData, apiAvailable: true };
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
			// Enforce WiFi-only setting - always check, even on resume
			try {
				const currentSettings: Settings = await settingsService.getSettings();
				if (currentSettings.wifi_only) {
					const network = detectNetwork();
					// Only block if we can confirm user is on mobile data (cellular)
					// Allow download on WiFi, ethernet, or when we can't determine
					if (network.apiAvailable && network.isWifi === false) {
						startingRef.current.delete(model.id);
						updateDownload(model.id, {
							status: "paused",
							error: "Mobile data detected. Connect to WiFi to download.",
						});
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

			modelService.downloadModel(model.id, handleEvent).catch((err) => {
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

	// Monitor network changes and pause downloads when WiFi is lost (if wifi_only is enabled)
	useEffect(() => {
		const nav = navigator as Navigator & {
			connection?: EventTarget & { type?: string };
		};
		const conn = nav.connection;

		const handleNetworkChange = async () => {
			// Check if we have active downloads
			if (activeRef.current.size === 0) return;

			// Check if wifi_only is enabled
			try {
				const settings = await settingsService.getSettings();
				if (!settings.wifi_only) return;
			} catch {
				return; // Can't verify settings, don't interrupt
			}

			// Pause downloads if switched to mobile data
			const network = detectNetwork();
			// Only pause if we can confirm user is now on cellular/mobile data
			if (network.apiAvailable && network.isWifi === false) {
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
								error: "Download paused: switched to mobile data",
							},
						};
					});
				}
				activeRef.current.clear();
			}
		};

		// Listen for connection changes
		if (conn) {
			conn.addEventListener("change", handleNetworkChange);
		}
		// Also listen for online/offline events as fallback
		window.addEventListener("offline", handleNetworkChange);

		return () => {
			if (conn) {
				conn.removeEventListener("change", handleNetworkChange);
			}
			window.removeEventListener("offline", handleNetworkChange);
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
