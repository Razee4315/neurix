import type { ChatHistoryEntry } from "@/services/chatService";
import type { ChatMessage, Conversation, StopReason } from "@/services/types";

/**
 * A message as shown in the chat view.
 *
 * `error` entries are local notices (a failed generation). They are never
 * sent to the model and never written to history.
 */
export interface Message {
	id: string;
	role: "user" | "ai" | "error";
	text: string;
	/** ISO time the message was created. Preserved across saves. */
	timestamp: string;
	/** How generation ended, for the "reply was cut short" affordance. */
	stopReason?: StopReason;
	/** What a reasoning model wrote before its answer. Shown collapsed. */
	reasoning?: string;
	/** The folder chosen in Create mode when this reply was written. */
	createIn?: string;
	/** What connectors this reply looked at. */
	sources?: string[];
	/** The character that wrote this reply, for this session only. */
	characterId?: string;
}

let counter = 0;

export function createMessage(
	role: Message["role"],
	text: string,
	extra: Partial<
		Pick<Message, "timestamp" | "stopReason" | "reasoning" | "createIn" | "sources" | "characterId">
	> = {},
): Message {
	counter += 1;
	return {
		id: `m${Date.now().toString(36)}-${counter}`,
		role,
		text,
		timestamp: extra.timestamp ?? new Date().toISOString(),
		...(extra.stopReason ? { stopReason: extra.stopReason } : {}),
		...(extra.reasoning ? { reasoning: extra.reasoning } : {}),
		...(extra.createIn ? { createIn: extra.createIn } : {}),
		...(extra.sources?.length ? { sources: extra.sources } : {}),
		...(extra.characterId ? { characterId: extra.characterId } : {}),
	};
}

/** Messages that belong to the conversation proper (no local error notices). */
export function persistable(messages: Message[]): Message[] {
	return messages.filter((m) => m.role !== "error");
}

/**
 * Build the (user, assistant) pairs sent to the model as context.
 *
 * Pairs are found by walking roles rather than by index, so a deleted
 * message, an error notice, or a stopped reply cannot shift the alignment
 * and silently drop everything after it. A user message with no reply is
 * skipped.
 */
export function buildHistory(messages: Message[]): ChatHistoryEntry[] {
	const pairs: ChatHistoryEntry[] = [];
	let pendingUser: string | null = null;
	for (const m of messages) {
		if (m.role === "user") {
			pendingUser = m.text;
		} else if (m.role === "ai" && pendingUser !== null) {
			pairs.push({ user: pendingUser, assistant: m.text });
			pendingUser = null;
		}
	}
	return pairs;
}

/** A short title from the first user message. */
export function generateTitle(messages: Message[]): string {
	const firstUser = messages.find((m) => m.role === "user");
	if (!firstUser) return "Chat";

	const text = firstUser.text.trim();
	if (text.length <= 50) return text;

	// Prefer the first sentence or clause.
	const sentenceEnd = text.search(/[.!?\n]/);
	if (sentenceEnd > 0 && sentenceEnd <= 60) return text.slice(0, sentenceEnd + 1);

	// Otherwise break at the last word boundary within 50 chars.
	const truncated = text.slice(0, 50);
	const lastSpace = truncated.lastIndexOf(" ");
	return `${lastSpace > 20 ? truncated.slice(0, lastSpace) : truncated}...`;
}

export function fromStored(messages: ChatMessage[]): Message[] {
	return messages.map((m) =>
		createMessage(m.role === "user" ? "user" : "ai", m.content, {
			timestamp: m.timestamp,
			reasoning: m.reasoning,
			sources: m.sources,
			stopReason: m.stop_reason,
		}),
	);
}

export function toStored(messages: Message[]): ChatMessage[] {
	return persistable(messages).map((m) => ({
		role: m.role === "user" ? "user" : "assistant",
		content: m.text,
		timestamp: m.timestamp,
		...(m.reasoning ? { reasoning: m.reasoning } : {}),
		...(m.sources?.length ? { sources: m.sources } : {}),
		...(m.stopReason ? { stop_reason: m.stopReason } : {}),
	}));
}

/** Added to a message while earlier replies came from another character. */
export const NEW_STYLE_NOTE = "(Answer in your own style, not the style of the earlier replies in this chat.)";

/** Whether any reply so far was written by a different character. */
export function spokenByAnother(messages: Message[], characterId: string | undefined): boolean {
	return messages.some((m) => m.role === "ai" && !!m.characterId && m.characterId !== characterId);
}

interface ConversationContext {
	id: string;
	modelId: string;
	modelName: string;
	characterId?: string;
	characterName?: string;
}

export function toConversation(messages: Message[], ctx: ConversationContext): Conversation {
	const now = new Date().toISOString();
	return {
		id: ctx.id,
		title: generateTitle(messages),
		model_id: ctx.modelId,
		model_name: ctx.modelName,
		character_id: ctx.characterId,
		character_name: ctx.characterName,
		// The backend keeps the original creation time once a file exists.
		created_at: now,
		updated_at: now,
		messages: toStored(messages),
	};
}

/** Whether a reply ended early in a way the user can act on. */
export function wasCutShort(reason: StopReason | undefined): boolean {
	return reason === "length" || reason === "repetition" || reason === "cancelled";
}

export function cutShortLabel(reason: StopReason | undefined): string {
	if (reason === "repetition") return "Stopped: the model started repeating itself.";
	if (reason === "cancelled") return "You stopped this reply.";
	return "Reply reached the length limit.";
}
