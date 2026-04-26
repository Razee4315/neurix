import { invoke } from "@tauri-apps/api/core";
import type { Character } from "./types";

export async function getPresetCharacters(): Promise<Character[]> {
	return invoke("get_preset_characters");
}
