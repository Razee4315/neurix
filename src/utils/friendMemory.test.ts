import { describe, expect, it } from "vitest";
import { learnedFacts, mergeMemories, undoLearning, withMemories } from "./friendMemory";
import { PERSONA_LIMITS, emptyPersona } from "./persona";
import type { Character } from "@/services/types";

const texts = (message: string) => learnedFacts(message).map((f) => f.text);

describe("learnedFacts", () => {
	it.each([
		["my dog is called Moti", "My dog is called Moti"],
		["My dog's name is Moti.", "My dog's name is Moti"],
		["hey, my name is Saqlain!", "My name is Saqlain"],
		["btw my birthday is on 4 March", "My birthday is on 4 March"],
		["My favourite colour is teal", "My favourite colour is teal"],
		["my sister is a doctor", "My sister is a doctor"],
		["I live in Lahore", "I live in Lahore"],
		["I'm from Multan", "I'm from Multan"],
		["i work as a nurse", "I work as a nurse"],
		["I am a teacher", "I am a teacher"],
		["I am 28 years old", "I am 28 years old"],
		["I love cricket", "I love cricket"],
		["I don't eat mushrooms", "I don't eat mushrooms"],
		["I have a cat called Momo", "I have a cat called Momo"],
		["I have two sons", "I have two sons"],
		["I'm allergic to peanuts", "I'm allergic to peanuts"],
		["call me Saqi", "Call me Saqi"],
		["mera naam Saqlain hai", "Mera naam Saqlain hai"],
		["main Lahore mein rehta hoon", "Main Lahore mein rehta hoon"],
	])("keeps %s", (message, fact) => {
		expect(texts(message)).toEqual([fact]);
	});

	it.each([
		["what is my dog called?"],
		["Do you know where I live in Lahore?"],
		["I'm a bit tired"],
		["I have a headache"],
		["I love you"],
		["I hate this"],
		["my phone is broken"],
		["my dog is sick today"],
		["my head hurts"],
		["If I live in Lahore, what then"],
		["I love pizza today"],
		["Tell me a story"],
		["remember when we were kids"],
		[""],
	])("ignores %s", (message) => {
		expect(texts(message)).toEqual([]);
	});

	it("finds facts inside a longer message", () => {
		expect(texts("Long day! My dog is called Moti. What should I cook? I live in Lahore")).toEqual([
			"My dog is called Moti",
			"I live in Lahore",
		]);
	});

	it.each([
		["My dog is called Sheru actually, and I live in Lahore"],
		["My dog is called Sheru and I live in Lahore"],
		["my dog is called Sheru, I live in Lahore"],
		["my dog is called Sheru but I live in Lahore"],
	])("splits two facts in one sentence: %s", (message) => {
		expect(texts(message)).toEqual(["My dog is called Sheru", "I live in Lahore"]);
	});

	it("doesn't split a fact on its own and", () => {
		expect(texts("I love cricket and football")).toEqual(["I love cricket and football"]);
	});

	it("keeps anything it is told to remember", () => {
		expect(texts("Please remember that the wedding is on 3 May")).toEqual(["The wedding is on 3 May"]);
		expect(texts("remember: Hina hates surprises")).toEqual(["Hina hates surprises"]);
	});

	it.each([
		["My password is hunter2"],
		["remember that my PIN is 4471"],
		["please remember my card number is 4242"],
		["my bank account is at HBL"],
	])("never stores a secret: %s", (message) => {
		expect(texts(message)).toEqual([]);
	});

	it("skips what is too long to be a short fact", () => {
		expect(texts(`I love ${"very ".repeat(30)}long things`)).toEqual([]);
	});
});

describe("mergeMemories", () => {
	it("adds a new fact", () => {
		const { memories, added } = mergeMemories(["I love cricket"], learnedFacts("my dog is called Moti"));
		expect(memories).toEqual(["I love cricket", "My dog is called Moti"]);
		expect(added).toEqual(["My dog is called Moti"]);
	});

	it("doesn't repeat what it already knows", () => {
		const { memories, added } = mergeMemories(["My dog is called Moti"], learnedFacts("my DOG is called moti"));
		expect(memories).toEqual(["My dog is called Moti"]);
		expect(added).toEqual([]);
	});

	it("replaces a fact that changed", () => {
		const moved = mergeMemories(["I live in Lahore", "I love cricket"], learnedFacts("I live in Karachi"));
		expect(moved.memories).toEqual(["I love cricket", "I live in Karachi"]);
		const dog = mergeMemories(["My dog is called Moti"], learnedFacts("my dog's name is Sheru"));
		expect(dog.memories).toEqual(["My dog's name is Sheru"]);
	});

	it("keeps separate likes side by side", () => {
		const { memories } = mergeMemories(["I love cricket"], learnedFacts("I love biryani"));
		expect(memories).toHaveLength(2);
	});

	it("drops the oldest when full", () => {
		const full = Array.from({ length: PERSONA_LIMITS.memories }, (_, i) => `Note ${i}`);
		const { memories } = mergeMemories(full, learnedFacts("I love cricket"));
		expect(memories).toHaveLength(PERSONA_LIMITS.memories);
		expect(memories[0]).toBe("Note 1");
		expect(memories.at(-1)).toBe("I love cricket");
	});
});

describe("undoLearning", () => {
	it("takes back only that fact, and keeps newer ones", () => {
		const first = mergeMemories([], learnedFacts("my dog is called Moti"));
		const second = mergeMemories(first.memories, learnedFacts("I live in Lahore"));
		expect(undoLearning(second.memories, first.added, first.replaced)).toEqual(["I live in Lahore"]);
	});

	it("brings back what the fact replaced", () => {
		const changed = mergeMemories(["I live in Lahore"], learnedFacts("I live in Karachi"));
		expect(changed.replaced).toEqual(["I live in Lahore"]);
		expect(undoLearning(changed.memories, changed.added, changed.replaced)).toEqual(["I live in Lahore"]);
	});
});

describe("withMemories", () => {
	it("puts the memories in the friend's prompt", () => {
		const friend = { id: "custom:1", name: "Sam", description: "", system_prompt: "old", persona: emptyPersona() } as unknown as Character;
		const updated = withMemories(friend, ["My dog is called Moti"]);
		expect(updated.persona?.memories).toEqual(["My dog is called Moti"]);
		expect(updated.system_prompt).toContain("My dog is called Moti");
	});
});
