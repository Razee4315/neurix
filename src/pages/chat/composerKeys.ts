import { rankMatches } from "@/utils/fuzzy";

/** What typing `/` in the message box offers. */
export interface SlashCommand {
	id: "new" | "think" | "create" | "model" | "find" | "history" | "connectors" | "settings";
	name: string;
	hint: string;
	/** Hidden on phones, where the feature doesn't exist. */
	desktopOnly?: boolean;
}

export const SLASH_COMMANDS: readonly SlashCommand[] = [
	{ id: "new", name: "new", hint: "Start a new chat" },
	{ id: "think", name: "think", hint: "Turn step by step reasoning on or off" },
	{ id: "create", name: "create", hint: "Turn Create files on or off", desktopOnly: true },
	{ id: "model", name: "model", hint: "Change the character or model" },
	{ id: "find", name: "find", hint: "Find in this chat" },
	{ id: "history", name: "history", hint: "Search all chats" },
	{ id: "connectors", name: "connectors", hint: "Connect folders and accounts" },
	{ id: "settings", name: "settings", hint: "Open Settings" },
];

/**
 * The commands to offer for what is typed. Only a message that is a single
 * `/word` opens the menu, so a sentence that mentions a path never does.
 */
export function matchSlashCommands(input: string, desktop: boolean): SlashCommand[] {
	const typed = input.match(/^\/(\S*)$/);
	if (!typed) return [];
	const available = SLASH_COMMANDS.filter((c) => desktop || !c.desktopOnly);
	return rankMatches(typed[1], available, (c) => c.name);
}

/**
 * Up and Down through earlier messages, like a shell. It only takes over when
 * the box is empty or still showing a recalled message, with the caret at the
 * edge, so ordinary multi-line editing is never interrupted.
 */
export function recallPrompt(options: {
	key: "ArrowUp" | "ArrowDown";
	input: string;
	caretAtStart: boolean;
	caretAtEnd: boolean;
	/** Sent messages, oldest first. */
	history: string[];
	/** Position in `history` being shown, or null when not recalling. */
	index: number | null;
}): { text: string; index: number | null } | null {
	const { key, input, caretAtStart, caretAtEnd, history, index } = options;
	const recalled = index !== null && history[index] === input;
	if (input !== "" && !recalled) return null;
	if (key === "ArrowUp") {
		if (!caretAtStart || history.length === 0) return null;
		const next = index === null ? history.length - 1 : Math.max(0, index - 1);
		return { text: history[next], index: next };
	}
	if (!caretAtEnd || index === null) return null;
	const next = index + 1;
	return next >= history.length ? { text: "", index: null } : { text: history[next], index: next };
}
