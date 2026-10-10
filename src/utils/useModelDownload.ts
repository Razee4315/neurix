import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useDownloads } from "@/context/DownloadContext";
import { notificationService } from "@/services";
import type { ModelInfo } from "@/services/types";
import { fitSummary, modelFit } from "@/utils/modelFit";
import { vibrate } from "@/utils/platform";
import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Start downloading a model and open its progress page.
 *
 * The button that calls this already states the model and its size, so
 * there is no "are you sure?" step — except when the model is larger than
 * this device is rated for, which is worth a second look before spending
 * gigabytes on it.
 */
export function useModelDownload() {
	const navigate = useNavigate();
	const { startDownload } = useDownloads();
	const { showConfirm } = useConfirm();

	return useCallback(
		async (model: ModelInfo, deviceMemoryBytes: number | null): Promise<boolean> => {
			const fit = modelFit(model, deviceMemoryBytes);
			if (fit === "tight" || fit === "too_big") {
				const ok = await showConfirm({
					title: fit === "too_big" ? "This model may not run here" : "This model is a tight fit",
					message: `${fitSummary(model, deviceMemoryBytes)}. It may be slow or fail to load. Download ${model.size_label} anyway?`,
					confirmLabel: "Download anyway",
					cancelLabel: "Cancel",
				});
				if (!ok) return false;
			}
			vibrate(10);
			// Asked here, where the reason is obvious: to be told when a long
			// download finishes.
			await notificationService.requestNotificationPermission();
			startDownload(model);
			navigate(`/downloading?id=${encodeURIComponent(model.id)}`, { state: { model } });
			return true;
		},
		[navigate, startDownload, showConfirm],
	);
}
