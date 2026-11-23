import type { Conversation } from "@/services/types";

const PINS_KEY = "neurix.chat.pins";
const FOLDERS_KEY = "neurix.chat.folders";

export interface ChatFolder {
	id: string;
	name: string;
	chats: string[];
}

export interface ChatMetadata {
	pins: string[];
	folders: ChatFolder[];
}

type ReadStorage = Pick<Storage, "getItem">;
type WriteStorage = Pick<Storage, "setItem">;

function readList(storage: ReadStorage, key: string): unknown[] {
	try {
		const value: unknown = JSON.parse(storage.getItem(key) ?? "null");
		return Array.isArray(value) ? value : [];
	} catch {
		return [];
	}
}

const isId = (value: unknown): value is string =>
	typeof value === "string" && /^[a-z0-9_-]{1,128}$/i.test(value);
const uniqueIds = (values: unknown[]) => [...new Set(values.filter(isId))];

export function readChatMeta(storage: ReadStorage): ChatMetadata {
	const pins = uniqueIds(readList(storage, PINS_KEY));
	const folders: ChatFolder[] = [];
	for (const entry of readList(storage, FOLDERS_KEY)) {
		if (!entry || typeof entry !== "object") continue;
		const { id, name, chats } = entry as Partial<ChatFolder>;
		if (!isId(id) || typeof name !== "string" || !name.trim() || folders.some((f) => f.id === id)) continue;
		folders.push({ id, name, chats: Array.isArray(chats) ? uniqueIds(chats) : [] });
	}
	return { pins, folders };
}

export function writeChatMeta(storage: WriteStorage, previous: ChatMetadata, next: ChatMetadata): void {
	if (previous.pins !== next.pins) storage.setItem(PINS_KEY, JSON.stringify(next.pins));
	if (previous.folders !== next.folders) storage.setItem(FOLDERS_KEY, JSON.stringify(next.folders));
}

export function assignChatFolder(folders: ChatFolder[], chatId: string, folderId: string): ChatFolder[] {
	const next = folders.map((folder) => {
		const exists = folder.chats.includes(chatId);
		if (folder.id === folderId && !exists) return { ...folder, chats: [...folder.chats, chatId] };
		if (folder.id !== folderId && exists) return { ...folder, chats: folder.chats.filter((id) => id !== chatId) };
		return folder;
	});
	return next.some((folder, i) => folder !== folders[i]) ? next : folders;
}

export function clearChatAssignments(storage: ReadStorage & WriteStorage): ChatMetadata {
	const current = readChatMeta(storage);
	const next = {
		pins: [],
		folders: current.folders.map((folder) => ({ ...folder, chats: [] })),
	};
	writeChatMeta(storage, current, next);
	return next;
}

export function conversationMarkdown(chat: Conversation): string {
	const title = chat.title.replace(/[\r\n]+/g, " ");
	const turns = chat.messages.map((message) => [
		`## ${message.role === "user" ? "User" : "Assistant"} · ${message.timestamp}`,
		message.content,
		...(message.reasoning ? [`### Reasoning\n\n${message.reasoning}`] : []),
		...(message.sources?.length ? [`### Sources\n\n${message.sources.map((source) => `- ${source}`).join("\n")}`] : []),
	].join("\n\n"));
	return [`# ${title}`, `${chat.model_name} · ${chat.created_at}`, ...turns, ""].join("\n\n");
}
