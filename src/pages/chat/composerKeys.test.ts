import { describe, expect, it } from "vitest";
import { matchSlashCommands, recallPrompt } from "./composerKeys";

describe("matchSlashCommands", () => {
	it("lists everything for a lone slash", () => {
		expect(matchSlashCommands("/", true).length).toBeGreaterThan(5);
	});

	it("narrows as you type", () => {
		expect(matchSlashCommands("/th", true).map((c) => c.id)).toEqual(["think"]);
		expect(matchSlashCommands("/set", true)[0].id).toBe("settings");
	});

	it("ignores ordinary messages", () => {
		expect(matchSlashCommands("hello", true)).toEqual([]);
		expect(matchSlashCommands("/usr/bin is a folder", true)).toEqual([]);
		expect(matchSlashCommands("see /new", true)).toEqual([]);
	});

	it("hides desktop features on a phone", () => {
		expect(matchSlashCommands("/create", false)).toEqual([]);
		expect(matchSlashCommands("/create", true).map((c) => c.id)).toEqual(["create"]);
	});
});

describe("recallPrompt", () => {
	const base = { caretAtStart: true, caretAtEnd: true, history: ["first", "second"], index: null as number | null };

	it("walks back from an empty box", () => {
		const one = recallPrompt({ ...base, key: "ArrowUp", input: "" });
		expect(one).toEqual({ text: "second", index: 1 });
		const two = recallPrompt({ ...base, key: "ArrowUp", input: "second", index: 1 });
		expect(two).toEqual({ text: "first", index: 0 });
		const stop = recallPrompt({ ...base, key: "ArrowUp", input: "first", index: 0 });
		expect(stop).toEqual({ text: "first", index: 0 });
	});

	it("walks forward and back to empty", () => {
		expect(recallPrompt({ ...base, key: "ArrowDown", input: "first", index: 0 })).toEqual({ text: "second", index: 1 });
		expect(recallPrompt({ ...base, key: "ArrowDown", input: "second", index: 1 })).toEqual({ text: "", index: null });
	});

	it("leaves real typing alone", () => {
		expect(recallPrompt({ ...base, key: "ArrowUp", input: "typing" })).toBeNull();
		expect(recallPrompt({ ...base, key: "ArrowUp", input: "first edited", index: 0 })).toBeNull();
	});

	it("waits for the caret to reach the edge", () => {
		expect(recallPrompt({ ...base, key: "ArrowUp", input: "second", index: 1, caretAtStart: false })).toBeNull();
		expect(recallPrompt({ ...base, key: "ArrowDown", input: "first", index: 0, caretAtEnd: false })).toBeNull();
	});

	it("does nothing with no history, or Down when not recalling", () => {
		expect(recallPrompt({ ...base, key: "ArrowUp", input: "", history: [] })).toBeNull();
		expect(recallPrompt({ ...base, key: "ArrowDown", input: "" })).toBeNull();
	});
});
