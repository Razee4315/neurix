import { characterService, settingsService } from "@/services";
import type { Character } from "@/services/types";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
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

const DEFAULT_ID = "preset:default";

export function CharacterProvider({ children }: { children: React.ReactNode }) {
	const { settings, updateSettings } = useAppContext();
	const [presets, setPresets] = useState<Character[]>([]);
	const [presetsLoaded, setPresetsLoaded] = useState(false);
	// One-time guard for the legacy-prompt migration. useRef so a flip from
	// false → true doesn't trigger a re-render or a second migration attempt
	// in StrictMode.
	const migrationDoneRef = useRef(false);

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
		if (migrationDoneRef.current) return;
		if (!presetsLoaded || !settings) return;
		if (settings.active_character_id) {
			migrationDoneRef.current = true;
			return; // Already on the new model.
		}
		const defaultPreset = presets.find((p) => p.id === DEFAULT_ID);
		const userPrompt = settings.system_prompt?.trim() ?? "";
		const defaultPrompt = defaultPreset?.system_prompt.trim() ?? "";

		migrationDoneRef.current = true;
		(async () => {
			try {
				if (userPrompt && userPrompt !== defaultPrompt) {
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
					await updateSettings({
						active_character_id: migrated.id,
						custom_characters: [...(settings.custom_characters ?? []), migrated],
					});
				} else {
					// No interesting prompt to migrate; just mark them on the new model.
					await updateSettings({ active_character_id: DEFAULT_ID });
				}
			} catch {
				// The legacy prompt stays in settings; the Default preset is
				// used until the next launch retries the migration.
			}
		})();
	}, [presetsLoaded, settings, presets, updateSettings]);

	const customs = useMemo<Character[]>(
		() => settings?.custom_characters ?? [],
		[settings],
	);

	const allCharacters = useMemo(() => [...presets, ...customs], [presets, customs]);

	const activeCharacter = useMemo<Character | null>(() => {
		if (!presetsLoaded || !settings) return null;
		const id = settings.active_character_id ?? DEFAULT_ID;
		return allCharacters.find((c) => c.id === id)
			?? allCharacters.find((c) => c.id === DEFAULT_ID)
			?? allCharacters[0]
			?? null;
	}, [presetsLoaded, settings, allCharacters]);

	// Custom characters are edited as a list. Read the stored list right
	// before changing it so an older copy held in React state cannot drop
	// an edit made elsewhere.
	const readStored = useCallback(() => settingsService.getSettings(), []);

	// Persist the active character id, and stamp a custom with last_used_at so
	// the picker can surface recently used items. Presets are not stored.
	const setActiveCharacter = useCallback(async (id: string) => {
		const existing = (await readStored()).custom_characters ?? [];
		if (existing.some((c) => c.id === id)) {
			const now = new Date().toISOString();
			await updateSettings({
				active_character_id: id,
				custom_characters: existing.map((c) => (c.id === id ? { ...c, last_used_at: now } : c)),
			});
		} else {
			await updateSettings({ active_character_id: id });
		}
	}, [readStored, updateSettings]);

	// Insert or update a custom character. Presets are immutable.
	const saveCustom = useCallback(async (character: Character) => {
		if (character.is_preset) return;
		const existing = (await readStored()).custom_characters ?? [];
		const idx = existing.findIndex((c) => c.id === character.id);
		const nextList = idx >= 0
			? existing.map((c, i) => (i === idx ? character : c))
			: [...existing, character];
		await updateSettings({ custom_characters: nextList });
	}, [readStored, updateSettings]);

	const deleteCustom = useCallback(async (id: string) => {
		const stored = await readStored();
		await updateSettings({
			custom_characters: (stored.custom_characters ?? []).filter((c) => c.id !== id),
			// If the deleted character was active, fall back to Default.
			...(stored.active_character_id === id ? { active_character_id: DEFAULT_ID } : {}),
		});
	}, [readStored, updateSettings]);

	const value = useMemo<CharacterContextValue>(
		() => ({
			allCharacters,
			presets,
			customs,
			activeCharacter,
			loaded: presetsLoaded && settings !== null,
			setActiveCharacter,
			saveCustom,
			deleteCustom,
		}),
		[allCharacters, presets, customs, activeCharacter, presetsLoaded, settings, setActiveCharacter, saveCustom, deleteCustom],
	);

	return <CharacterContext.Provider value={value}>{children}</CharacterContext.Provider>;
}

export function useCharacters() {
	return useContext(CharacterContext);
}
