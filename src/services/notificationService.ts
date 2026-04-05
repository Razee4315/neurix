import {
	isPermissionGranted,
	requestPermission,
	sendNotification,
	createChannel,
	removeActive,
	Importance,
	Visibility,
} from "@tauri-apps/plugin-notification";

let channelsCreated = false;

/** Create Android notification channels (required on Android 8+). Call once at app startup. */
async function ensureChannels(): Promise<void> {
	if (channelsCreated) return;
	try {
		await createChannel({
			id: "downloads",
			name: "Downloads",
			description: "Model download progress and completion",
			importance: Importance.Low,
			visibility: Visibility.Public,
			vibration: false,
		});
		await createChannel({
			id: "general",
			name: "General",
			description: "General app notifications",
			importance: Importance.Default,
			visibility: Visibility.Private,
			vibration: true,
		});
		channelsCreated = true;
	} catch {
		// Channel creation failed — notifications may not work on this platform
	}
}

/** Check if notification permission is already granted. */
export async function isGranted(): Promise<boolean> {
	try {
		return await isPermissionGranted();
	} catch {
		return false;
	}
}

/** Request notification permission from the user. Returns true if granted. */
export async function requestNotificationPermission(): Promise<boolean> {
	try {
		const already = await isPermissionGranted();
		if (already) return true;
		const result = await requestPermission();
		return result === "granted";
	} catch {
		return false;
	}
}

/** Initialize notification system — call once on app startup. */
export async function init(): Promise<void> {
	await ensureChannels();
}

// Fixed notification ID for download progress (so updates replace the previous notification)
const DOWNLOAD_NOTIFICATION_ID = 9001;

// Throttle: only send system notification every 5% to avoid Android rate limiting
let lastNotifiedPercent = -1;

/** Show/update a download progress notification in the system tray. */
export async function notifyDownloadProgress(
	modelName: string,
	percent: number,
): Promise<void> {
	// Throttle to every 5% to avoid Android notification rate limiting
	const rounded = Math.floor(percent / 5) * 5;
	if (rounded === lastNotifiedPercent && rounded < 100) return;
	lastNotifiedPercent = rounded;

	try {
		const granted = await isPermissionGranted();
		if (!granted) return;
		await ensureChannels();

		sendNotification({
			id: DOWNLOAD_NOTIFICATION_ID,
			title: "Downloading Model",
			body: `${modelName} — ${rounded}%`,
			channelId: "downloads",
			ongoing: true,
			autoCancel: false,
		});
	} catch {
		// Notification failed — not critical
	}
}

/** Show download complete notification (replaces progress notification). */
export async function notifyDownloadComplete(modelName: string): Promise<void> {
	lastNotifiedPercent = -1;
	try {
		const granted = await isPermissionGranted();
		if (!granted) return;
		await ensureChannels();

		// Remove the ongoing progress notification first
		try {
			await removeActive([{ id: DOWNLOAD_NOTIFICATION_ID }]);
		} catch {
			// May not exist
		}

		sendNotification({
			id: DOWNLOAD_NOTIFICATION_ID + 1,
			title: "Download Complete",
			body: `${modelName} is ready to use`,
			channelId: "downloads",
			ongoing: false,
			autoCancel: true,
		});
	} catch {
		// Notification failed — not critical
	}
}

/** Show download failed notification. */
export async function notifyDownloadFailed(
	modelName: string,
	error?: string,
): Promise<void> {
	lastNotifiedPercent = -1;
	try {
		const granted = await isPermissionGranted();
		if (!granted) return;
		await ensureChannels();

		// Remove the ongoing progress notification
		try {
			await removeActive([{ id: DOWNLOAD_NOTIFICATION_ID }]);
		} catch {
			// May not exist
		}

		sendNotification({
			id: DOWNLOAD_NOTIFICATION_ID + 2,
			title: "Download Failed",
			body: error ? `${modelName}: ${error}` : `${modelName} download failed`,
			channelId: "downloads",
			ongoing: false,
			autoCancel: true,
		});
	} catch {
		// Notification failed — not critical
	}
}

/** Clear the ongoing download notification (e.g. when user cancels). */
export async function clearDownloadNotification(): Promise<void> {
	lastNotifiedPercent = -1;
	try {
		await removeActive([{ id: DOWNLOAD_NOTIFICATION_ID }]);
	} catch {
		// May not exist
	}
}