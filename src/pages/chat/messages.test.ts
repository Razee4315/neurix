import { describe, expect, it } from "vitest";
import {
	buildHistory,
	createMessage,
	fromStored,
	generateTitle,
	persistable,
	toConversation,
	toStored,
	wasCutShort,
} from "./messages";

const u = (t: string) => createMessage("user", t);
const a = (t: string) => createMessage("ai", t);
const e = (t: string) => createMessage("error", t);

describe("buildHistory", () => {
	it("pairs alternating messages", () => {
		expect(buildHistory([u("q1"), a("a1"), u("q2"), a("a2")])).toEqual([
			{ user: "q1", assistant: "a1" },
			{ user: "q2", assistant: "a2" },
		]);
	});

	it("keeps later pairs when a reply was deleted", () => {
		// q1's reply was deleted; index-based pairing used to drop q2/a2 too.
		expect(buildHistory([u("q1"), u("q2"), a("a2"), u("q3"), a("a3")])).toEqual([
			{ user: "q2", assistant: "a2" },
			{ user: "q3", assistant: "a3" },
		]);
	});

	it("keeps later pairs when a user message was deleted", () => {
		expect(buildHistory([a("orphan"), u("q2"), a("a2")])).toEqual([
			{ user: "q2", assistant: "a2" },
		]);
	});

	it("ignores error notices", () => {
		expect(buildHistory([u("q1"), e("boom"), u("q2"), a("a2")])).toEqual([
			{ user: "q2", assistant: "a2" },
		]);
	});

	it("skips a trailing user message with no reply", () => {
		expect(buildHistory([u("q1"), a("a1"), u("q2")])).toEqual([{ user: "q1", assistant: "a1" }]);
	});
});

describe("storage mapping", () => {
	it("never persists error notices", () => {
		const stored = toStored([u("q"), e("failed"), a("ok")]);
		expect(stored.map((m) => m.role)).toEqual(["user", "assistant"]);
		expect(persistable([e("x")])).toHaveLength(0);
	});

	it("preserves message timestamps through a round trip", () => {
		const original = [
			{ role: "user" as const, content: "hi", timestamp: "2026-01-01T10:00:00.000Z" },
			{ role: "assistant" as const, content: "hello", timestamp: "2026-01-01T10:00:05.000Z" },
		];
		expect(toStored(fromStored(original))).toEqual(original);
	});

	it("records the real model id", () => {
		const conv = toConversation([u("q"), a("r")], {
			id: "c1",
			modelId: "qwen-2.5-0.5b",
			modelName: "Qwen 2.5 0.5B",
		});
		expect(conv.model_id).toBe("qwen-2.5-0.5b");
		expect(conv.title).toBe("q");
	});
});

describe("generateTitle", () => {
	it("uses short prompts whole", () => {
		expect(generateTitle([u("Hello there")])).toBe("Hello there");
	});

	it("cuts long prompts at a word boundary", () => {
		const title = generateTitle([u("word ".repeat(30))]);
		expect(title.endsWith("...")).toBe(true);
		expect(title.length).toBeLessThanOrEqual(53);
	});

	it("falls back when there is no user message", () => {
		expect(generateTitle([a("hi")])).toBe("Chat");
	});
});

describe("wasCutShort", () => {
	it("flags only actionable stop reasons", () => {
		expect(wasCutShort("length")).toBe(true);
		expect(wasCutShort("repetition")).toBe(true);
		expect(wasCutShort("eos")).toBe(false);
		expect(wasCutShort("cancelled")).toBe(false);
		expect(wasCutShort(undefined)).toBe(false);
	});
});
