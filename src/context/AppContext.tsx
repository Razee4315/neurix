import { modelService, settingsService } from "@/services";
import type { ActiveModel, Settings } from "@/services/types";
import { applyFontSize, applyTheme } from "@/theme/themes";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

interface AppContextValue {
	settings: Settings | null;
	/** True when settings could not be read at all (UI should say so). */
	settingsFailed: boolean;
	/** Display name of the selected model, or null when none is loaded. */
	activeModel: string | null;
	activeModelId: string | null;
	/** Everything the backend reports about the loaded model. */
	activeModelInfo: ActiveModel | null;
	refreshSettings: () => Promise<void>;
	refreshActiveModel: () => Promise<ActiveModel | null>;
	/**
	 * Persist a partial settings change and update the context with what the
	 * backend stored. Rejects if the write fails so callers can roll back.
	 */
	updateSettings: (patch: Partial<Settings>) => Promise<Settings>;
	/** Load a model and sync the active-model state. Rejects on failure. */
	loadModel: (modelId: string) => Promise<void>;
	unloadModel: () => Promise<void>;
}

const AppContext = createContext<AppContextValue>({
	settings: null,
	settingsFailed: false,
	activeModel: null,
	activeModelId: null,
	activeModelInfo: null,
	refreshSettings: async () => {},
	refreshActiveModel: async () => null,
	updateSettings: async () => {
		throw new Error("AppProvider is missing");
	},
	loadModel: async () => {},
	unloadModel: async () => {},
});

// A hanging native load (corrupt file, memory pressure) must not leave the
// UI on a spinner forever.
const LOAD_TIMEOUT_MS = 90_000;

export function AppProvider({ children }: { children: React.ReactNode }) {
	const [settings, setSettings] = useState<Settings | null>(null);
	const [settingsFailed, setSettingsFailed] = useState(false);
	const [active, setActive] = useState<ActiveModel | null>(null);

	const refreshSettings = useCallback(async () => {
		try {
			setSettings(await settingsService.getSettings());
			setSettingsFailed(false);
		} catch {
			setSettingsFailed(true);
		}
	}, []);

	const refreshActiveModel = useCallback(async () => {
		try {
			const model = await modelService.getActiveModel();
			setActive(model);
			return model;
		} catch {
			return null;
		}
	}, []);

	const updateSettings = useCallback(async (patch: Partial<Settings>) => {
		const stored = await settingsService.patchSettings(patch);
		setSettings(stored);
		return stored;
	}, []);

	const loadModel = useCallback(
		async (modelId: string) => {
			let timer: ReturnType<typeof setTimeout> | undefined;
			const timeout = new Promise<never>((_, reject) => {
				timer = setTimeout(
					() =>
						reject(
							new Error(
								"Loading took too long. The file may be damaged or too large for this device.",
							),
						),
					LOAD_TIMEOUT_MS,
				);
			});
			try {
				await Promise.race([modelService.loadModel(modelId), timeout]);
			} finally {
				clearTimeout(timer);
				await refreshActiveModel();
			}
		},
		[refreshActiveModel],
	);

	const unloadModel = useCallback(async () => {
		await modelService.unloadModel();
		await refreshActiveModel();
	}, [refreshActiveModel]);

	useEffect(() => {
		refreshSettings();
		refreshActiveModel();
	}, [refreshSettings, refreshActiveModel]);

	// Appearance follows settings. The theme is also mirrored to localStorage
	// (inside applyTheme) so the next launch paints correctly before this runs.
	useEffect(() => {
		if (!settings) return;
		applyTheme(settings.theme);
		applyFontSize(settings.font_size);
	}, [settings]);

	const value = useMemo<AppContextValue>(
		() => ({
			settings,
			settingsFailed,
			activeModel: active?.name ?? null,
			activeModelId: active?.id ?? null,
			activeModelInfo: active,
			refreshSettings,
			refreshActiveModel,
			updateSettings,
			loadModel,
			unloadModel,
		}),
		[
			settings,
			settingsFailed,
			active,
			refreshSettings,
			refreshActiveModel,
			updateSettings,
			loadModel,
			unloadModel,
		],
	);

	return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
	return useContext(AppContext);
}
