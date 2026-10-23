import { describe, expect, it } from "vitest";
import { INLINE, isTableDivider } from "./markdownPatterns";

const matches = (text: string) => [...text.matchAll(INLINE)].map((m) => m[0]);

/** Run `fn` and return how long it took in milliseconds. */
const timed = (fn: () => void) => {
	const start = performance.now();
	fn();
	return performance.now() - start;
};

describe("INLINE", () => {
	it("still finds bold, italic, code and links", () => {
		expect(
			matches("**b** and *i* and `c` and [docs](https://example.com/a)"),
		).toEqual(["**b**", "*i*", "`c`", "[docs](https://example.com/a)"]);
	});

	it("keeps bold that contains a single star", () => {
		expect(matches("**a*b**")).toEqual(["**a*b**"]);
	});

	it("does not link non-https schemes", () => {
		expect(matches("[x](javascript:alert(1))")).toEqual([]);
	});

	// The unbounded pattern took ~640 ms on 20k brackets and grows with the
	// square of the length, so 200k would take about a minute. Bounded it is
	// linear: well under a second locally, with room for slow CI runners.
	it("stays linear on a long line of brackets", () => {
		const line = "[".repeat(200_000);
		expect(timed(() => matches(line))).toBeLessThan(5000);
	});

	it("stays linear on long runs of stars and backticks", () => {
		expect(timed(() => matches("**x".repeat(50_000)))).toBeLessThan(1000);
		expect(timed(() => matches("`x".repeat(100_000)))).toBeLessThan(1000);
	});
});

describe("isTableDivider", () => {
	it("recognises dividers", () => {
		expect(isTableDivider("|---|:---:|")).toBe(true);
		expect(isTableDivider("--- | ---")).toBe(true);
		expect(isTableDivider("not a divider")).toBe(false);
		expect(isTableDivider(undefined)).toBe(false);
	});

	it("rejects a huge line without scanning it", () => {
		const line = `${" ".repeat(200_000)}x`;
		expect(timed(() => isTableDivider(line))).toBeLessThan(50);
		expect(isTableDivider(line)).toBe(false);
	});
});
