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
	/** How long the model thought before answering. */
	thoughtMs?: number;
	/** The character that wrote this reply, for this session only. */
	characterId?: string;
	/**
	 * Every answer (AI) or wording (user) this message has had, oldest first.
	 * Absent until it is branched; the fields above mirror the active one.
	 * See branching.ts.
	 */
	variants?: MessageVariant[];
	/** Which of `variants` is showing. */
	activeVariant?: number;
}

/** One branch of a message. */
export interface MessageVariant {
	text: string;
	reasoning?: string;
	thoughtMs?: number;
	sources?: string[];
	stopReason?: StopReason;
	/** For a user wording: the rest of the chat that followed it. */
	tail?: Message[];
}

/** A stored variant. Only AI answers are stored, never user tails. */
interface StoredVariant {
	content: string;
	reasoning?: string;
	sources?: string[];
	stop_reason?: StopReason;
	thought_ms?: number;
}

/** A saved message, plus branches when the backend keeps them. */
type StoredMessage = ChatMessage & { variants?: StoredVariant[]; active_variant?: number };

let counter = 0;

export function createMessage(
	role: Message["role"],
	text: string,
	extra: Partial<
		Pick<Message, "timestamp" | "stopReason" | "reasoning" | "createIn" | "sources" | "characterId" | "thoughtMs">
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
		...(extra.thoughtMs ? { thoughtMs: extra.thoughtMs } : {}),
	};
}

/** Messages that belong to the conversation proper (no local error notices). */
export function persistable(messages: Message[]): Message[] {
	return messages.filter((m) => m.role !== "error");
}

export function stripThinkingTags(text: string): string {
	let visible = "";
	let start = 0;
	let depth = 0;
	for (const { 0: tag, index } of text.matchAll(/<\/?think>/gi)) {
		if (tag[1] !== "/") {
			if (depth === 0) visible += text.slice(start, index);
			depth += 1;
		} else if (depth > 0) {
			depth -= 1;
			if (depth === 0) start = index + tag.length;
		}
	}
	return depth === 0 ? visible + text.slice(start) : visible;
}

/**
 * Build the (user, assistant) pairs sent to the model as context.
 *
 * Pairs are found by walking roles rather than by index, so a deleted
 * message, an error notice, or a stopped reply cannot shift the alignment
 * and silently drop everything after it. A user message with no reply is
 * skipped.
 */
export function buildHistory(messages: Message[], stripThinking = true): ChatHistoryEntry[] {
	const pairs: ChatHistoryEntry[] = [];
	let pendingUser: string | null = null;
	for (const m of messages) {
		if (m.role === "user") {
			pendingUser = m.text;
		} else if (m.role === "ai" && pendingUser !== null) {
			pairs.push({ user: pendingUser, assistant: stripThinking ? stripThinkingTags(m.text) : m.text });
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

/** Saved branches, read back only when they are well formed. */
function variantsFromStored(m: StoredMessage): Pick<Message, "variants" | "activeVariant"> {
	const stored = Array.isArray(m.variants) ? m.variants.filter((v) => typeof v?.content === "string") : [];
	if (m.role !== "assistant" || stored.length < 2) return {};
	const variants: MessageVariant[] = stored.map((v) => ({
		text: v.content,
		...(v.reasoning ? { reasoning: v.reasoning } : {}),
		...(v.sources?.length ? { sources: v.sources } : {}),
		...(v.stop_reason ? { stopReason: v.stop_reason } : {}),
		...(v.thought_ms ? { thoughtMs: v.thought_ms } : {}),
	}));
	const index = typeof m.active_variant === "number" ? m.active_variant : variants.length - 1;
	return { variants, activeVariant: Math.min(Math.max(index, 0), variants.length - 1) };
}

export function fromStored(messages: ChatMessage[]): Message[] {
	return messages.map((m) => {
		const message = createMessage(m.role === "user" ? "user" : "ai", m.content, {
			timestamp: m.timestamp,
			reasoning: m.reasoning,
			sources: m.sources,
			stopReason: m.stop_reason,
			thoughtMs: m.thought_ms,
		});
		const branches = variantsFromStored(m as StoredMessage);
		return branches.variants ? { ...message, ...branches } : message;
	});
}

/** AI answers with more than one variant keep them all when saved. */
function variantsToStored(m: Message): Pick<StoredMessage, "variants" | "active_variant"> {
	if (m.role !== "ai" || !m.variants || m.variants.length < 2) return {};
	return {
		variants: m.variants.map((v) => ({
			content: v.text,
			...(v.reasoning ? { reasoning: v.reasoning } : {}),
			...(v.sources?.length ? { sources: v.sources } : {}),
			...(v.stopReason ? { stop_reason: v.stopReason } : {}),
			...(v.thoughtMs ? { thought_ms: v.thoughtMs } : {}),
		})),
		active_variant: m.activeVariant ?? m.variants.length - 1,
	};
}

export function toStored(messages: Message[]): ChatMessage[] {
	return persistable(messages).map(
		(m): StoredMessage => ({
			role: m.role === "user" ? "user" : "assistant",
			content: m.text,
			timestamp: m.timestamp,
			...(m.reasoning ? { reasoning: m.reasoning } : {}),
			...(m.sources?.length ? { sources: m.sources } : {}),
			...(m.stopReason ? { stop_reason: m.stopReason } : {}),
			...(m.thoughtMs ? { thought_ms: m.thoughtMs } : {}),
			...variantsToStored(m),
		}),
	);
}

/** Added to a message while earlier replies came from another character. */
export const NEW_STYLE_NOTE = "(Answer in your own style, not the style of the earlier replies in this chat.)";

/**
 * What the model sees of earlier replies once the character has changed. It
 * copies what it sees, so another character's emojis would carry over.
 */
export function plainEarlierReplies(messages: Message[], characterId: string | undefined): Message[] {
	return messages.map((m) =>
		m.role === "ai" && m.characterId && m.characterId !== characterId
			? { ...m, text: m.text.replace(/\p{Extended_Pictographic}\uFE0F?/gu, "").replace(/ {2,}/g, " ").trim() }
			: m,
	);
}

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
	if (reason === "cancelled") return "This reply stopped before the end.";
	return "Reply reached the length limit.";
}
