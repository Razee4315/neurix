import { modelService, settingsService } from "@/services";
import type { ActiveModel, Settings } from "@/services/types";
import { applyFontSize, applyTheme } from "@/theme/themes";
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { type ModelStatus, activeOf, initialModelState, loadingIdOf, modelReducer } from "./modelMachine";

export type { ModelStatus } from "./modelMachine";

interface AppContextValue {
	settings: Settings | null;
	/** True when settings could not be read at all (UI should say so). */
	settingsFailed: boolean;
	/**
	 * The model in memory: idle, loading (nothing usable yet), or ready.
	 * The single source of truth for "is a model loading?" across the app.
	 */
	modelStatus: ModelStatus;
	/** Id of the model being loaded, or null. Shorthand for `modelStatus`. */
	loadingModelId: string | null;
	/** Display name of the loaded model, or null when none is ready. */
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
	/**
	 * Load a model and sync the active-model state. Rejects on failure or
	 * after a timeout. Asking again for the model already loading shares
	 * that load; asking for another queues behind it (the latest wins).
	 */
	loadModel: (modelId: string) => Promise<void>;
	unloadModel: () => Promise<void>;
}

const AppContext = createContext<AppContextValue>({
	settings: null,
	settingsFailed: false,
	modelStatus: { kind: "idle" },
	loadingModelId: null,
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
	const [model, dispatch] = useReducer(modelReducer, initialModelState);
	const modelRef = useRef(model);
	modelRef.current = model;
	const ticketRef = useRef(0);
	// The load in flight, so a second request for the same model shares it.
	const inflightRef = useRef<{ id: string; ticket: number; promise: Promise<void> } | null>(null);

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
			const active = await modelService.getActiveModel();
			dispatch({ type: "SYNCED", model: active });
			return active;
		} catch {
			return null;
		}
	}, []);

	const updateSettings = useCallback(async (patch: Partial<Settings>) => {
		const stored = await settingsService.patchSettings(patch);
		setSettings(stored);
		return stored;
	}, []);

	const loadModel = useCallback((modelId: string): Promise<void> => {
		const { status } = modelRef.current;
		if (status.kind === "ready" && status.model.id === modelId) return Promise.resolve();
		const inflight = inflightRef.current;
		if (inflight?.id === modelId) return inflight.promise;

		const ticket = ++ticketRef.current;
		dispatch({ type: "LOAD_STARTED", id: modelId, ticket });

		// Runs to the end even if the caller stops waiting, so a load that
		// finishes late is still picked up (and a later one queues behind it).
		const native = modelService.loadModel(modelId);
		const ended = native
			.then(
				(): { ok: true } | { ok: false; error: unknown } => ({ ok: true }),
				(error: unknown) => ({ ok: false, error }),
			)
			.then(async (outcome) => {
				let active: ActiveModel | null = null;
				try {
					active = await modelService.getActiveModel();
				} catch {
					// Unknown: treat as nothing loaded.
				}
				dispatch({ type: "LOAD_ENDED", ticket, model: active });
				if (inflightRef.current?.ticket === ticket) inflightRef.current = null;
				return outcome;
			});

		let timer: ReturnType<typeof setTimeout> | undefined;
		const timeout = new Promise<never>((_, reject) => {
			timer = setTimeout(() => {
				dispatch({ type: "LOAD_ABANDONED", ticket });
				if (inflightRef.current?.ticket === ticket) inflightRef.current = null;
				reject(new Error("Loading took too long. The file may be damaged or too large for this device."));
			}, LOAD_TIMEOUT_MS);
		});
		const promise = Promise.race([
			ended.then((outcome) => {
				if (!outcome.ok) throw outcome.error;
			}),
			timeout,
		]).finally(() => clearTimeout(timer));

		inflightRef.current = { id: modelId, ticket, promise };
		return promise;
	}, []);

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

	const active = activeOf(model.status);
	const value = useMemo<AppContextValue>(
		() => ({
			settings,
			settingsFailed,
			modelStatus: model.status,
			loadingModelId: loadingIdOf(model.status),
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
			model.status,
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
