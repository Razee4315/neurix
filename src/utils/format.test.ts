import { describe, expect, it } from "vitest";
import { LIMITS } from "./characterLimits";
import { parseShared } from "./characterShare";
import { formatBytes, formatEta, formatSpeed } from "./format";

describe("formatBytes", () => {
	it("picks a sensible unit", () => {
		expect(formatBytes(512)).toBe("512 B");
		expect(formatBytes(1536)).toBe("1.5 KB");
		expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
		expect(formatBytes(2 * 1024 ** 3)).toBe("2.00 GB");
	});
});

describe("formatSpeed / formatEta", () => {
	it("shows a placeholder when there is no speed", () => {
		expect(formatSpeed(0)).toBe("--");
		expect(formatEta(1000, 0)).toBe("--");
	});

	it("formats speed and remaining time", () => {
		expect(formatSpeed(2 * 1024 * 1024)).toBe("2.0 MB/s");
		expect(formatEta(30, 1)).toBe("30s");
		expect(formatEta(600, 1)).toBe("10 min");
		expect(formatEta(7200, 1)).toBe("2.0 hr");
	});
});

describe("character import limits", () => {
	const envelope = (character: Record<string, unknown>) =>
		JSON.stringify({
			kind: "neurix.character",
			version: 1,
			character: {
				name: "Guide",
				icon: "school",
				system_prompt: "Be brief.",
				temperature: 0.7,
				top_p: 0.9,
				max_tokens: 512,
				...character,
			},
		});

	it("clamps an oversized reply length instead of rejecting", () => {
		const result = parseShared(envelope({ max_tokens: 8192 }));
		expect(result.ok && result.draft.max_tokens).toBe(LIMITS.maxTokensMax);
	});

	it("applies the same text limits as the editor", () => {
		const result = parseShared(
			envelope({ name: "n".repeat(100), system_prompt: "p".repeat(5000), greeting: "g".repeat(500) }),
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.draft.name).toHaveLength(LIMITS.name);
		expect(result.draft.system_prompt).toHaveLength(LIMITS.prompt);
		expect(result.draft.greeting).toHaveLength(LIMITS.greeting);
	});

	it("replaces an unknown icon with a safe default", () => {
		const result = parseShared(envelope({ icon: "constructor" }));
		expect(result.ok && result.draft.icon).toBe("person");
	});
});
