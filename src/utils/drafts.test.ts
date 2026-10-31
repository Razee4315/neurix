import { beforeEach, describe, expect, it, vi } from "vitest";
import { readDraft, writeDraft } from "./drafts";

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
	getItem: (key: string) => store.get(key) ?? null,
	setItem: (key: string, value: string) => store.set(key, value),
	removeItem: (key: string) => store.delete(key),
});

describe("drafts", () => {
	beforeEach(() => store.clear());

	it("keeps a draft per chat", () => {
		writeDraft("a", "hello a");
		writeDraft("b", "hello b");
		expect(readDraft("a")).toBe("hello a");
		expect(readDraft("b")).toBe("hello b");
	});

	it("keeps a new chat's draft apart", () => {
		writeDraft(null, "unsaved");
		expect(readDraft(null)).toBe("unsaved");
		expect(readDraft("a")).toBe("");
	});

	it("forgets a draft once it is empty", () => {
		writeDraft("a", "text");
		writeDraft("a", "");
		expect(readDraft("a")).toBe("");
	});

	it("brings the old single draft over to a new chat", () => {
		localStorage.setItem("neurix.chat.draft", "from before");
		expect(readDraft(null)).toBe("from before");
		writeDraft(null, "");
		expect(localStorage.getItem("neurix.chat.draft")).toBeNull();
	});

	it("drops the oldest past the limit", () => {
		for (let i = 0; i < 45; i++) writeDraft(`chat${i}`, "text");
		expect(readDraft("chat0")).toBe("");
		expect(readDraft("chat44")).toBe("text");
	});
});
