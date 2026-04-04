import { createContext, useCallback, useContext, useRef, useState } from "react";
import { modelService, settingsService } from "@/services";
import type { DownloadEvent, ModelInfo, Settings } from "@/services/types";

// Network detection using Navigator.connection API
function isOnWifi(): boolean {
	const nav = navigator as Navigator & {
		connection?: { type?: string; effectiveType?: string };
	};
	const conn = nav.connection;
	if (!conn || !conn.type) return true; // Unknown = allow (desktop fallback)
	return conn.type === "wifi" || conn.type === "ethernet";
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
	startDownload: (model: ModelInfo) => Promise<void> | void;
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
	const activeChannelsRef = useRef<Set<string>>(new Set());

	const updateDownload = useCallback((modelId: string, patch: Partial<DownloadState>) => {
		setDownloads((prev) => {
			const existing = prev[modelId];
			if (!existing) return prev;
			return { ...prev, [modelId]: { ...existing, ...patch } };
		});
	}, []);

	const startDownload = useCallback(async (model: ModelInfo) => {
		if (activeChannelsRef.current.has(model.id)) return;

		// Enforce WiFi-only setting
		try {
			const currentSettings: Settings = await settingsService.getSettings();
			if (currentSettings.wifi_only && !isOnWifi()) {
				setDownloads((prev) => ({
					...prev,
					[model.id]: {
						modelId: model.id,
						modelName: model.name,
						sizeLabel: model.size_label,
						status: "failed",
						totalBytes: model.size_bytes,
						downloadedBytes: 0,
						speedBps: 0,
						error: "WiFi-only mode is enabled. Connect to WiFi to download.",
					},
				}));
				return;
			}
		} catch {
			// If settings check fails, proceed anyway
		}

		// Check available disk space before starting
		try {
			const hasSpace = await settingsService.checkAvailableSpace(model.size_bytes);
			if (!hasSpace) {
				setDownloads((prev) => ({
					...prev,
					[model.id]: {
						modelId: model.id,
						modelName: model.name,
						sizeLabel: model.size_label,
						status: "failed",
						totalBytes: model.size_bytes,
						downloadedBytes: 0,
						speedBps: 0,
						error: "Not enough storage space. Free up space and try again.",
					},
				}));
				return;
			}
		} catch {
			// If space check fails, proceed anyway
		}

		activeChannelsRef.current.add(model.id);

		setDownloads((prev) => ({
			...prev,
			[model.id]: {
				modelId: model.id,
				modelName: model.name,
				sizeLabel: model.size_label,
				status: "downloading",
				totalBytes: model.size_bytes,
				downloadedBytes: 0,
				speedBps: 0,
			},
		}));

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
					activeChannelsRef.current.delete(model.id);
					break;
				case "Failed":
					updateDownload(model.id, {
						status: "failed",
						speedBps: 0,
						error: event.data && "error" in event.data ? event.data.error : "Unknown error",
					});
					activeChannelsRef.current.delete(model.id);
					break;
				case "Cancelled":
					updateDownload(model.id, { status: "paused", speedBps: 0 });
					activeChannelsRef.current.delete(model.id);
					break;
			}
		};

		modelService.downloadModel(model.id, handleEvent).catch((err) => {
			updateDownload(model.id, { status: "failed", error: String(err) });
			activeChannelsRef.current.delete(model.id);
		});
	}, [updateDownload]);

	const pauseDownload = useCallback((modelId: string) => {
		modelService.cancelDownload(modelId);
		// Status will be set to "paused" when Cancelled event arrives
	}, []);

	const resumeDownload = useCallback((model: ModelInfo) => {
		if (activeChannelsRef.current.has(model.id)) return;
		startDownload(model);
	}, [startDownload]);

	const cancelDownload = useCallback((modelId: string) => {
		modelService.cancelDownload(modelId);
		activeChannelsRef.current.delete(modelId);
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
