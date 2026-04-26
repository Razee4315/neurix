import { characterService, settingsService } from "@/services";
import type { Character, Settings } from "@/services/types";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAppContext } from "./AppContext";

interface CharacterContextValue {
	/** All characters: presets first, then user-created custom ones. */
	allCharacters: Character[];
	presets: Character[];
	customs: Character[];
	/** The character currently selected as the default for new chats. */
	activeCharacter: Character | null;
	/** True until the initial preset fetch + settings load resolves. */
	loaded: boolean;
	setActiveCharacter: (id: string) => Promise<void>;
	saveCustom: (character: Character) => Promise<void>;
	deleteCustom: (id: string) => Promise<void>;
}

const CharacterContext = createContext<CharacterContextValue>({
	allCharacters: [],
	presets: [],
	customs: [],
	activeCharacter: null,
	loaded: false,
	setActiveCharacter: async () => {},
	saveCustom: async () => {},
	deleteCustom: async () => {},
});

export function CharacterProvider({ children }: { children: React.ReactNode }) {
	const { settings, refreshSettings } = useAppContext();
	const [presets, setPresets] = useState<Character[]>([]);
	const [presetsLoaded, setPresetsLoaded] = useState(false);
	const migrationDoneRef = useState(() => ({ done: false }))[0];

	useEffect(() => {
		characterService.getPresetCharacters()
			.then((list) => setPresets(list))
			.catch(() => setPresets([]))
			.finally(() => setPresetsLoaded(true));
	}, []);

	// One-time migration. Pre-character-feature, users had a free-form
	// system_prompt field. If theirs differs from the Default preset's
	// prompt, convert it into a "My prompt" custom character so they don't
	// silently lose it after the upgrade.
	useEffect(() => {
		if (migrationDoneRef.done) return;
		if (!presetsLoaded || !settings) return;
		if (settings.active_character_id) {
			migrationDoneRef.done = true;
			return; // Already on the new model.
		}
		const defaultPreset = presets.find((p) => p.id === "preset:default");
		const userPrompt = settings.system_prompt?.trim() ?? "";
		const defaultPrompt = defaultPreset?.system_prompt.trim() ?? "";

		(async () => {
			migrationDoneRef.done = true;
			if (userPrompt && userPrompt !== defaultPrompt) {
				// Convert legacy prompt into a custom character.
				const migrated: Character = {
					id: `custom:migrated-${Date.now().toString(36)}`,
					name: "My prompt",
					description: "Migrated from your previous system prompt",
					icon: "history_edu",
					system_prompt: userPrompt,
					temperature: settings.temperature,
					top_p: settings.top_p,
					max_tokens: settings.max_tokens,
					is_preset: false,
					created_at: new Date().toISOString(),
				};
				const next: Settings = {
					...settings,
					active_character_id: migrated.id,
					custom_characters: [...(settings.custom_characters ?? []), migrated],
				};
				await settingsService.updateSettings(next);
			} else {
				// No interesting prompt to migrate; just mark them on the new model.
				const next: Settings = { ...settings, active_character_id: "preset:default" };
				await settingsService.updateSettings(next);
			}
			await refreshSettings();
		})();
	}, [presetsLoaded, settings, presets, refreshSettings, migrationDoneRef]);

	const customs = useMemo<Character[]>(
		() => settings?.custom_characters ?? [],
		[settings],
	);

	const allCharacters = useMemo(() => [...presets, ...customs], [presets, customs]);

	const activeCharacter = useMemo<Character | null>(() => {
		if (!presetsLoaded || !settings) return null;
		const id = settings.active_character_id ?? "preset:default";
		return allCharacters.find((c) => c.id === id)
			?? allCharacters.find((c) => c.id === "preset:default")
			?? allCharacters[0]
			?? null;
	}, [presetsLoaded, settings, allCharacters]);

	// Persist the active character id back to settings.
	const setActiveCharacter = useCallback(async (id: string) => {
		if (!settings) return;
		const next: Settings = { ...settings, active_character_id: id };
		await settingsService.updateSettings(next);
		await refreshSettings();
	}, [settings, refreshSettings]);

	// Insert or update a custom character. Presets are immutable.
	const saveCustom = useCallback(async (character: Character) => {
		if (!settings) return;
		if (character.is_preset) return;
		const existing = settings.custom_characters ?? [];
		const idx = existing.findIndex((c) => c.id === character.id);
		const nextList = idx >= 0
			? existing.map((c, i) => (i === idx ? character : c))
			: [...existing, character];
		const next: Settings = { ...settings, custom_characters: nextList };
		await settingsService.updateSettings(next);
		await refreshSettings();
	}, [settings, refreshSettings]);

	const deleteCustom = useCallback(async (id: string) => {
		if (!settings) return;
		const existing = settings.custom_characters ?? [];
		const nextList = existing.filter((c) => c.id !== id);
		// If the deleted character was active, fall back to Default.
		const nextActiveId = settings.active_character_id === id
			? "preset:default"
			: settings.active_character_id;
		const next: Settings = {
			...settings,
			custom_characters: nextList,
			active_character_id: nextActiveId,
		};
		await settingsService.updateSettings(next);
		await refreshSettings();
	}, [settings, refreshSettings]);

	return (
		<CharacterContext.Provider
			value={{
				allCharacters,
				presets,
				customs,
				activeCharacter,
				loaded: presetsLoaded && settings !== null,
				setActiveCharacter,
				saveCustom,
				deleteCustom,
			}}
		>
			{children}
		</CharacterContext.Provider>
	);
}

export function useCharacters() {
	return useContext(CharacterContext);
}
