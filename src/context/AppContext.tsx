import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Settings } from "@/services/types";
import { settingsService, modelService } from "@/services";

interface AppContextValue {
	settings: Settings | null;
	activeModel: string | null;
	refreshSettings: () => Promise<void>;
	refreshActiveModel: () => Promise<void>;
}

const AppContext = createContext<AppContextValue>({
	settings: null,
	activeModel: null,
	refreshSettings: async () => {},
	refreshActiveModel: async () => {},
});

export function AppProvider({ children }: { children: React.ReactNode }) {
	const [settings, setSettings] = useState<Settings | null>(null);
	const [activeModel, setActiveModel] = useState<string | null>(null);

	const refreshSettings = useCallback(async () => {
		try {
			const s = await settingsService.getSettings();
			setSettings(s);
		} catch (e) {
			console.error("Failed to load settings:", e);
		}
	}, []);

	const refreshActiveModel = useCallback(async () => {
		try {
			const model = await modelService.getActiveModel();
			setActiveModel(model);
		} catch (e) {
			console.error("Failed to get active model:", e);
		}
	}, []);

	useEffect(() => {
		refreshSettings();
		refreshActiveModel();
	}, [refreshSettings, refreshActiveModel]);

	return (
		<AppContext.Provider value={{ settings, activeModel, refreshSettings, refreshActiveModel }}>
			{children}
		</AppContext.Provider>
	);
}

export function useAppContext() {
	return useContext(AppContext);
}
