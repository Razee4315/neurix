import { invoke } from "@tauri-apps/api/core";
import type { Conversation, ConversationMeta } from "./types";

export async function getConversations(): Promise<ConversationMeta[]> {
	return invoke("get_conversations");
}

/** Conversations whose title or any message contains `query`. */
export async function searchConversations(query: string): Promise<ConversationMeta[]> {
	return invoke("search_conversations", { query });
}

export async function loadConversation(id: string): Promise<Conversation | null> {
	return invoke("load_conversation", { id });
}

/** Fired on `window` whenever the saved list changes (the sidebar listens). */
export const HISTORY_CHANGED = "neurix:history-changed";
/** Fired when a new chat gets its first message, before it is saved. */
export const CHAT_STARTED = "neurix:chat-started";

const changed = () => window.dispatchEvent(new Event(HISTORY_CHANGED));

export async function saveConversation(conversation: Conversation): Promise<void> {
	await invoke("save_conversation", { conversation });
	changed();
}

export async function deleteConversation(id: string): Promise<void> {
	await invoke("delete_conversation", { id });
	changed();
}

export async function clearAllConversations(): Promise<void> {
	await invoke("clear_all_conversations");
	changed();
}
