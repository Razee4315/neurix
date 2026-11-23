import type { ChatMessage, Conversation } from "@/services/types";

type Fields = Record<string, unknown>;
const record = (value: unknown): Fields | undefined =>
	value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Fields) : undefined;
const text = (value: unknown) => typeof value === "string" ? value : "";
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const epoch = "1970-01-01T00:00:00.000Z";

function timestamp(value: unknown): string | undefined {
	const time = typeof value === "number" ? value * 1000 : Date.parse(text(value));
	const date = new Date(time);
	return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

function textParts(parts: unknown): string {
	return list(parts).map((part) => {
		if (typeof part === "string") return part;
		const block = record(part);
		return block?.type === "text" || block?.content_type === "text" ? text(block.text) : "";
	}).filter((part) => part.trim()).join("\n\n");
}

function chatGptMessages(mapping: Fields, currentNode: unknown, fallback: string): ChatMessage[] {
	const nodes = new Map(Object.entries(mapping).map(([id, node]) => [id, record(node)]));
	let nodeId = text(currentNode);
	if (!nodes.has(nodeId)) {
		// Older exports may lack a current node. Choose the newest leaf, then
		// walk its ancestors so sibling replies are never interleaved.
		const parents = new Set([...nodes.values()].map((node) => text(node?.parent)));
		let latest = "";
		for (const [id, node] of nodes) {
			if (parents.has(id)) continue;
			const date = timestamp(record(node?.message)?.create_time) ?? "";
			if (date < latest) continue;
			latest = date;
			nodeId = id;
		}
	}
	const seen = new Set<string>();
	const messages: ChatMessage[] = [];
	while (nodeId && !seen.has(nodeId)) {
		seen.add(nodeId);
		const node = nodes.get(nodeId);
		const message = record(node?.message);
		nodeId = text(node?.parent);
		if (!message || record(message.metadata)?.is_visually_hidden_from_conversation === true) continue;
		const role = record(message.author)?.role;
		if (role !== "user" && role !== "assistant") continue;
		const body = record(message.content);
		const content = textParts(body?.parts) || text(body?.text);
		if (content.trim()) messages.push({ role, content, timestamp: timestamp(message.create_time) ?? fallback });
	}
	return messages.reverse();
}

function claudeMessages(value: unknown[], fallback: string): ChatMessage[] {
	const messages: ChatMessage[] = [];
	for (const item of value) {
		const message = record(item);
		if (message?.sender !== "human" && message?.sender !== "assistant") continue;
		const content = textParts(message.content) || text(message.text);
		if (!content.trim()) continue;
		messages.push({
			role: message.sender === "human" ? "user" : "assistant",
			content,
			timestamp: timestamp(message.created_at) ?? fallback,
		});
	}
	return messages;
}

function importedId(source: string, original: string, fallback: () => string): string {
	if (/^[a-z0-9_-]{1,110}$/i.test(original)) return `${source}-${original}`;
	// FNV-1a gives legacy records without an ID a stable, filename-safe key.
	let hash = 2166136261;
	for (const char of original || fallback()) hash = Math.imul(hash ^ (char.codePointAt(0) ?? 0), 16777619);
	return `${source}-legacy-${(hash >>> 0).toString(16)}`;
}

/** Convert text turns from ChatGPT's selected branch or Claude's conversation export. */
export function parseCloudImport(input: string): Conversation[] {
	let value: unknown;
	try {
		value = JSON.parse(input.trim());
	} catch {
		throw new Error("Choose a valid ChatGPT or Claude conversations JSON file.");
	}
	const wrapped = record(value)?.conversations;
	const entries = Array.isArray(value) ? value : Array.isArray(wrapped) ? wrapped : [value];
	const conversations: Conversation[] = [];
	for (const entry of entries) {
		const chat = record(entry);
		if (!chat) continue;
		const mapping = record(chat.mapping);
		const claude = Array.isArray(chat.chat_messages);
		if (!mapping && !claude) continue;
		const source = mapping ? "chatgpt" : "claude";
		const created = timestamp(chat.create_time ?? chat.created_at);
		const updated = timestamp(chat.update_time ?? chat.updated_at);
		const fallback = created ?? updated ?? epoch;
		const messages = mapping
			? chatGptMessages(mapping, chat.current_node, fallback)
			: claudeMessages(list(chat.chat_messages), fallback);
		const first = messages[0];
		if (!first) continue;
		const modelName = mapping ? "ChatGPT" : "Claude";
		const title = text(chat.title ?? chat.name).trim() || `Imported ${modelName} chat`;
		conversations.push({
			id: importedId(source, text(chat.id ?? chat.conversation_id ?? chat.uuid),
				() => JSON.stringify([title, messages])),
			title,
			model_id: source,
			model_name: modelName,
			created_at: created ?? first.timestamp,
			updated_at: updated ?? messages[messages.length - 1].timestamp,
			messages,
		});
	}
	if (!conversations.length) throw new Error("No readable ChatGPT or Claude chats were found in this file.");
	return conversations;
}
