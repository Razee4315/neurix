import { describe, expect, it } from "vitest";
import { LIMITS } from "./characterLimits";
import { parseShared, serializeShared } from "./characterShare";
import {
	FRIEND_TEMPLATES,
	PERSONA_LIMITS,
	RELATIONSHIPS,
	TRAITS,
	compilePersona,
	emptyPersona,
	normalizePersona,
	personaSampling,
} from "./persona";
import type { Character } from "@/services/types";

describe("compilePersona", () => {
	it("turns every choice into the prompt", () => {
		const prompt = compilePersona("Sam", "Always up for a chat", {
			...emptyPersona(),
			relationship: "best_friend",
			traits: ["warm", "playful", "loyal"],
			backstory: "Grew up next door",
			style: 'says "no way!" a lot',
			user_name: "Ali",
			memories: ["Works night shifts", "Has a cat called Momo"],
			emoji: true,
		});
		expect(prompt).toContain("You are Sam, Ali's best friend");
		expect(prompt).toContain("Always up for a chat.");
		expect(prompt).toContain("Your personality: warm, playful and loyal.");
		expect(prompt).toContain("About you: Grew up next door.");
		expect(prompt).toContain('How you talk: says "no way!" a lot.');
		expect(prompt).toContain("Call them Ali.");
		expect(prompt).toContain("- Has a cat called Momo");
		expect(prompt).toContain("Use an emoji now and then.");
		expect(prompt).toContain("Stay in character as Sam.");
		expect(prompt).toContain("say so honestly");
	});

	it("leaves out what was not filled in", () => {
		const prompt = compilePersona("Iris", "", emptyPersona());
		expect(prompt).toContain("You are Iris, the user's friend.");
		expect(prompt).not.toContain("Your personality");
		expect(prompt).not.toContain("About you");
		expect(prompt).not.toContain("Call them");
		expect(prompt).not.toContain("has told you");
		expect(prompt).toContain("Don't use emojis.");
	});

	it("keeps every template well inside what a small model follows", () => {
		for (const t of FRIEND_TEMPLATES) {
			const prompt = compilePersona(t.name, t.tagline, {
				...t.persona,
				user_name: "Alexandra",
				memories: Array.from({ length: PERSONA_LIMITS.memories }, () => "x".repeat(PERSONA_LIMITS.memory)),
			});
			expect(prompt.length, t.id).toBeLessThan(LIMITS.prompt);
		}
	});
});

describe("templates", () => {
	it("only use known relationships, traits and short fields", () => {
		for (const t of FRIEND_TEMPLATES) {
			expect(RELATIONSHIPS.some((r) => r.id === t.persona.relationship), t.id).toBe(true);
			for (const trait of t.persona.traits) {
				expect(TRAITS.some((x) => x.id === trait), `${t.id} ${trait}`).toBe(true);
			}
			expect(t.name.length).toBeLessThanOrEqual(LIMITS.name);
			expect(t.tagline.length).toBeLessThanOrEqual(LIMITS.description);
			expect(t.greeting.length).toBeLessThanOrEqual(LIMITS.greeting);
		}
	});

	it("have no em dashes in their text", () => {
		for (const t of FRIEND_TEMPLATES) {
			const text = [t.tagline, t.greeting, t.persona.backstory, t.persona.style].join(" ");
			expect(text.includes("—"), t.id).toBe(false);
		}
	});
});

describe("normalizePersona", () => {
	it("repairs anything stored or imported", () => {
		const p = normalizePersona({
			relationship: "enemy",
			traits: ["warm", "evil", 3, "calm"],
			formality: 99,
			humor: -4,
			length: "long",
			emoji: "yes",
			memories: ["", "  ", "real one", 7],
		});
		expect(p.relationship).toBe("friend");
		expect(p.traits).toEqual(["warm", "calm"]);
		expect(p.formality).toBe(4);
		expect(p.humor).toBe(0);
		expect(p.length).toBe(0);
		expect(p.emoji).toBe(false);
		expect(p.memories).toEqual(["real one"]);
		expect(normalizePersona(null)).toEqual(emptyPersona());
	});
});

describe("personaSampling", () => {
	it("follows humour and reply length", () => {
		const calm = personaSampling({ ...emptyPersona(), humor: 0, length: 0 });
		const silly = personaSampling({ ...emptyPersona(), humor: 4, length: 2 });
		expect(silly.temperature).toBeGreaterThan(calm.temperature);
		expect(silly.max_tokens).toBeGreaterThan(calm.max_tokens);
		expect(silly.max_tokens).toBeLessThanOrEqual(LIMITS.maxTokensMax);
	});
});

describe("sharing a friend", () => {
	it("leaves out what the friend knows about you", () => {
		const persona = { ...emptyPersona(), user_name: "Ali", memories: ["Works night shifts"] };
		const friend: Character = {
			id: "custom:1",
			name: "Sam",
			description: "Old friend",
			icon: "favorite",
			system_prompt: compilePersona("Sam", "Old friend", persona),
			temperature: 0.8,
			top_p: 0.92,
			max_tokens: 192,
			is_preset: false,
			persona,
		};
		const json = serializeShared(friend);
		expect(json).not.toContain("Ali");
		expect(json).not.toContain("night shifts");

		const parsed = parseShared(json);
		expect(parsed.ok).toBe(true);
		if (parsed.ok) {
			expect(parsed.draft.persona?.relationship).toBe("friend");
			expect(parsed.draft.persona?.memories).toEqual([]);
		}
	});
});
