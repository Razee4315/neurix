const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;

export function formatBytes(bytes: number): string {
	if (bytes < KB) return `${bytes} B`;
	if (bytes < MB) return `${(bytes / KB).toFixed(1)} KB`;
	if (bytes < GB) return `${(bytes / MB).toFixed(1)} MB`;
	return `${(bytes / GB).toFixed(2)} GB`;
}

export function formatGB(bytes: number): string {
	return (bytes / GB).toFixed(1);
}

export function formatSpeed(bps: number): string {
	if (bps <= 0) return "--";
	if (bps < MB) return `${(bps / KB).toFixed(1)} KB/s`;
	return `${(bps / MB).toFixed(1)} MB/s`;
}

export function formatEta(bytesRemaining: number, speedBps: number): string {
	if (speedBps <= 0) return "--";
	const seconds = bytesRemaining / speedBps;
	if (seconds < 60) return `${Math.ceil(seconds)}s`;
	if (seconds < 3600) return `${Math.ceil(seconds / 60)} min`;
	return `${(seconds / 3600).toFixed(1)} hr`;
}

/** Short random id for client-created records (characters). */
export function shortId(): string {
	return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
