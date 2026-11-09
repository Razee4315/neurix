import type { ConversationMeta } from "@/services/types";
import { describe, expect, it } from "vitest";
import { addPending, dropPending, mergeSaved } from "./recents";

const saved = (id: string): ConversationMeta => ({ id, title: id, model_name: "m", updated_at: "2026-01-01T00:00:00Z" });

describe("sidebar recents", () => {
	it("a new chat shows on top at once, marked pending", () => {
		const list = addPending([saved("old")], "new", "Hello");
		expect(list.map((c) => c.id)).toEqual(["new", "old"]);
		expect(list[0].pending).toBe(true);
	});

	it("a pending chat survives a refresh that does not include it yet", () => {
		const list = mergeSaved(addPending([], "new", "Hello"), [saved("old")]);
		expect(list.map((c) => c.id)).toEqual(["new", "old"]);
	});

	it("once saved, the stored entry replaces the pending one", () => {
		const list = mergeSaved(addPending([], "new", "Hello"), [saved("new"), saved("old")]);
		expect(list.map((c) => c.id)).toEqual(["new", "old"]);
		expect(list[0].pending).toBeUndefined();
	});

	it("a failed first save drops the pending chat instead of leaving a ghost", () => {
		let list: ReturnType<typeof mergeSaved> | null = addPending([saved("old")], "new", "Hello");
		list = dropPending(list, "new");
		expect(list?.map((c) => c.id)).toEqual(["old"]);
		// And later refreshes do not bring it back.
		expect(mergeSaved(list, [saved("old")]).map((c) => c.id)).toEqual(["old"]);
	});

	it("a failed later save leaves an already-saved chat alone", () => {
		const list = [saved("a")];
		expect(dropPending(list, "a")).toBe(list);
	});
});
