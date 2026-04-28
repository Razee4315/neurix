import { describe, expect, it } from "vitest";
import type { Character } from "@/services/types";
import { parseShared, serializeShared } from "./characterShare";

const fixture: Character = {
	id: "preset:default",
	name: "Default",
	description: "Helpful and balanced",
	icon: "auto_awesome",
	accent_color: "#8ff5ff",
	system_prompt: "You are a helpful assistant.",
	temperature: 0.7,
	top_p: 0.9,
	max_tokens: 512,
	conversation_starters: ["Hi"],
	greeting: "Hi! What can I help you with?",
	is_preset: true,
	created_at: "2025-01-01T00:00:00.000Z",
};

describe("characterShare.serializeShared", () => {
	it("strips identity fields (id, is_preset, created_at)", () => {
		const json = serializeShared(fixture);
		const parsed = JSON.parse(json);
		expect(parsed.character.id).toBeUndefined();
		expect(parsed.character.is_preset).toBeUndefined();
		expect(parsed.character.created_at).toBeUndefined();
	});

	it("emits the wire-format header", () => {
		const parsed = JSON.parse(serializeShared(fixture));
		expect(parsed.kind).toBe("neurix.character");
		expect(parsed.version).toBe(1);
	});
});

describe("characterShare.parseShared", () => {
	it("round-trips a valid character", () => {
		const json = serializeShared(fixture);
		const result = parseShared(json);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.draft.name).toBe("Default");
		expect(result.draft.greeting).toBe("Hi! What can I help you with?");
		expect(result.draft.is_preset).toBe(false);
	});

	it("rejects non-JSON input", () => {
		const result = parseShared("not json at all");
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toMatch(/JSON/i);
	});

	it("rejects wrong kind", () => {
		const result = parseShared(
			JSON.stringify({ kind: "something-else", version: 1, character: {} }),
		);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toMatch(/Neurix/);
	});

	it("rejects unsupported version", () => {
		const json = JSON.stringify({
			kind: "neurix.character",
			version: 99,
			character: fixture,
		});
		const result = parseShared(json);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toMatch(/version/i);
	});

	it("rejects missing name", () => {
		const json = JSON.stringify({
			kind: "neurix.character",
			version: 1,
			character: { ...fixture, name: "" },
		});
		const result = parseShared(json);
		expect(result.ok).toBe(false);
	});

	it("rejects missing system_prompt", () => {
		const json = JSON.stringify({
			kind: "neurix.character",
			version: 1,
			character: { ...fixture, system_prompt: "" },
		});
		const result = parseShared(json);
		expect(result.ok).toBe(false);
	});

	it("rejects out-of-range temperature", () => {
		const json = JSON.stringify({
			kind: "neurix.character",
			version: 1,
			character: { ...fixture, temperature: 5 },
		});
		const result = parseShared(json);
		expect(result.ok).toBe(false);
	});

	it("forces is_preset to false on import", () => {
		// Even if a malicious payload says is_preset:true, the import should
		// always produce a custom character so it can be edited/deleted.
		const json = JSON.stringify({
			kind: "neurix.character",
			version: 1,
			character: { ...fixture, is_preset: true },
		});
		const result = parseShared(json);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.draft.is_preset).toBe(false);
	});

	it("drops invalid accent_color silently", () => {
		const json = JSON.stringify({
			kind: "neurix.character",
			version: 1,
			character: { ...fixture, accent_color: "javascript:alert(1)" },
		});
		const result = parseShared(json);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.draft.accent_color).toBeUndefined();
	});

	it("clamps long strings on import", () => {
		const long = "x".repeat(10_000);
		const json = JSON.stringify({
			kind: "neurix.character",
			version: 1,
			character: { ...fixture, system_prompt: long, name: long },
		});
		const result = parseShared(json);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.draft.name.length).toBeLessThanOrEqual(64);
		expect(result.draft.system_prompt.length).toBeLessThanOrEqual(4000);
	});
});
