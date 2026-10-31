import { describe, expect, it } from "vitest";
import { matchScore, rankMatches } from "./fuzzy";

describe("matchScore", () => {
	it("ranks exact, start, word start, anywhere, then scattered letters", () => {
		const scores = [
			matchScore("model", "model"),
			matchScore("model", "models page"),
			matchScore("model", "new model here"),
			matchScore("odel", "new models"),
			matchScore("mdl", "models"),
		] as number[];
		expect(scores).toEqual([...scores].sort((a, b) => b - a));
		expect(new Set(scores).size).toBe(scores.length);
	});

	it("rejects what doesn't match", () => {
		expect(matchScore("zzz", "models")).toBeNull();
		expect(matchScore("sledom", "models")).toBeNull();
	});

	it("ignores case and matches everything on an empty query", () => {
		expect(matchScore("MODEL", "model")).toBe(1000);
		expect(matchScore("  ", "anything")).toBe(0);
	});
});

describe("rankMatches", () => {
	const label = (s: string) => s;

	it("puts the best match first and drops the rest", () => {
		expect(rankMatches("set", ["Reset app", "Settings", "Models"], label)).toEqual(["Settings", "Reset app"]);
	});

	it("keeps the given order when the query is empty", () => {
		expect(rankMatches("", ["b", "a"], label)).toEqual(["b", "a"]);
	});
});
