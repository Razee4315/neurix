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
/** Fired when saving a conversation failed; `detail.id` names it. */
export const CHAT_SAVE_FAILED = "neurix:chat-save-failed";

const changed = () => window.dispatchEvent(new Event(HISTORY_CHANGED));

export async function saveConversation(conversation: Conversation): Promise<void> {
	try {
		await invoke("save_conversation", { conversation });
	} catch (err) {
		window.dispatchEvent(new CustomEvent(CHAT_SAVE_FAILED, { detail: { id: conversation.id } }));
		throw err;
	}
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
