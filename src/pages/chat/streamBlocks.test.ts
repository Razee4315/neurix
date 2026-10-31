import { describe, expect, it } from "vitest";
import { splitStableBlocks } from "./streamBlocks";

describe("splitStableBlocks", () => {
	it("cuts at blank lines", () => {
		expect(splitStableBlocks("one\n\ntwo\nthree\n\n\nfour")).toEqual(["one", "two\nthree", "four"]);
	});

	it("keeps a code block whole, blank lines included", () => {
		const code = "```js\nconst a = 1;\n\nconst b = 2;\n```";
		expect(splitStableBlocks(`before\n\n${code}\n\nafter`)).toEqual(["before", code, "after"]);
	});

	it("keeps an unfinished code block open to the end", () => {
		expect(splitStableBlocks("```js\nconst a = 1;\n\nconst b")).toEqual(["```js\nconst a = 1;\n\nconst b"]);
	});

	it("leaves finished pieces identical as more text arrives", () => {
		const early = splitStableBlocks("first\n\nsecond");
		const later = splitStableBlocks("first\n\nsecond line\n\nthird");
		expect(later[0]).toBe(early[0]);
	});

	it("handles an empty reply", () => {
		expect(splitStableBlocks("")).toEqual([]);
	});
});
