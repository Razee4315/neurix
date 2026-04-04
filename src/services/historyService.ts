import { invoke } from "@tauri-apps/api/core";
import type { Conversation, ConversationMeta } from "./types";

export async function getConversations(): Promise<ConversationMeta[]> {
	return invoke("get_conversations");
}

export async function loadConversation(id: string): Promise<Conversation | null> {
	return invoke("load_conversation", { id });
}

export async function saveConversation(conversation: Conversation): Promise<void> {
	return invoke("save_conversation", { conversation });
}

export async function deleteConversation(id: string): Promise<void> {
	return invoke("delete_conversation", { id });
}

export async function clearAllConversations(): Promise<void> {
	return invoke("clear_all_conversations");
}
