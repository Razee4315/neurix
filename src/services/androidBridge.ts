/**
 * The small native bridge the Android app exposes as `window.NeurixAndroid`
 * (see DownloadBridge.kt). It does not exist on desktop or in a browser, so
 * every call here is optional and silent when the bridge is missing.
 */
interface NeurixAndroid {
	startDownloadService(title: string): void;
	stopDownloadService(): void;
}

function bridge(): NeurixAndroid | undefined {
	return (window as Window & { NeurixAndroid?: NeurixAndroid }).NeurixAndroid;
}

/** True when downloads can keep running with the app in the background. */
export function canDownloadInBackground(): boolean {
	return bridge() !== undefined;
}

/**
 * Ask Android to keep the app alive while a download runs, so switching
 * apps or locking the screen does not interrupt it.
 */
export function keepAliveForDownload(modelName: string): void {
	try {
		bridge()?.startDownloadService(modelName);
	} catch {
		// The download still runs while the app stays open.
	}
}

export function releaseDownloadKeepAlive(): void {
	try {
		bridge()?.stopDownloadService();
	} catch {
		// Nothing to release.
	}
}
