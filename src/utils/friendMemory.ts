import type { Character } from "@/services/types";
import { LIMITS } from "./characterLimits";
import { PERSONA_LIMITS, compilePersona } from "./persona";

/**
 * Friends learn from what you tell them. Facts are picked out of your own
 * messages by these rules rather than by the model: a second model pass would
 * make the next reply re-read the whole chat, and a small model invents
 * details. The cost is that only plainly stated facts are caught. Each one is
 * kept in the user's own words, and is shown with an Undo.
 */

const LONGEST_FACT = 80;

const LEAD_IN = /^(?:(?:well|so|oh|hey|hi|also|and|btw|by the way|actually|fyi|just so you know|you know)[,:\s]+)+/i;

/** Not worth keeping forever, or not a statement of fact at all. */
const PASSING = /\b(?:if|maybe|might|would|wish|suppose|imagine|pretend|yesterday|today|tomorrow|tonight|now|this (?:morning|evening|week|weekend|month))\b/i;

/** Never stored, even when asked to. */
const SECRET = /\b(?:passwords?|passcodes?|pins?|otp|cvv|cards?|cnic|ssn|api keys?|tokens?|account numbers?|bank accounts?)\b/i;

const ATTRIBUTES = /^my (name|birthday|job|profession|hometown|major|favou?rite \w+(?: \w+)?) (?:is|are)\b/i;

const PEOPLE =
	"dog|cat|pet|puppy|kitten|bird|parrot|wife|husband|partner|girlfriend|boyfriend|fianc[eé]e?|son|daughter|kids?|children|brother|sister|mother|mom|mum|father|dad|grandmother|grandma|grandfather|grandpa|uncle|aunt|cousin|best friend|roommate|boss";
const ABOUT_SOMEONE = new RegExp(
	`^my (${PEOPLE})(?:'s name is| (?:is|are) (?:called|named|an?)\\b| (?:lives?|works?) (?:in|at|as|for)\\b| studies\\b)`,
	"i",
);

/** Each pattern's slot: a newer fact in the same slot replaces the older one. */
const ABOUT_ME: readonly [RegExp, string?][] = [
	[/^i (?:live|stay) in\b/i, "home"],
	[/^i(?:'m| am) from\b/i, "origin"],
	[/^i (?:was born|grew up) in\b/i, "origin"],
	[/^i work (?:as|at|in|for)\b/i, "work"],
	[/^i(?:'m| am) (?:studying|a student)\b/i, "study"],
	[/^i study\b/i, "study"],
	[/^i(?:'m| am) \d{1,3}(?: years old)?$/i, "age"],
	[/^i speak\b/i],
	[/^i(?:'m| am) (?:allergic to|vegetarian|vegan|married|single|engaged|divorced|muslim|christian|hindu)\b/i],
	[/^i(?:'m| am) an? (?!(?:bit|little|lot|tad|mess|wreck)\b)\w+/i],
	[/^i (?:really |absolutely |also )?(?:love|like|enjoy|hate|dislike|prefer) (?!(?:this|that|it|you|them|him|her|these|those|how|when|what)\b)\w+/i],
	[/^i (?:don't|do not) (?:like|eat|drink)\b/i],
	[/^i have an? (?!(?:headache|cold|fever|cough|question|problem|idea|meeting|exam|test|feeling)\b)\w+/i],
	[/^i have (?:two|three|four|five|six|\d+) \w+/i],
	[/^call me \S+/i, "name"],
];

/** Roman Urdu, which the same people type as often as English. */
const URDU_ABOUT_ME = /^(?:mera|meri|mere) (naam|kutta|billi|bhai|behan|beta|beti|ghar|shehar|kaam|biwi|shohar|ammi|abbu)\b.* ha[ii]n?$/i;
const URDU_LIVES = /^main .+ (?:rehta|rehti) (?:hoon|hun|hu)$/i;

const REMEMBER = /^(?:please remember|remember(?: that|:)|don't forget(?: that|:)?)\s*(?:that\s+)?(.+)/i;

interface Fact {
	text: string;
	/** Facts sharing a slot replace each other, like a new home town. */
	slot?: string;
}

/** Whether a sentence states a lasting fact, and which slot it fills. */
function classify(sentence: string): { slot?: string } | null {
	const attribute = sentence.match(ATTRIBUTES) ?? sentence.match(ABOUT_SOMEONE);
	if (attribute) return { slot: `my ${attribute[1].toLowerCase()}` };
	const urdu = sentence.match(URDU_ABOUT_ME);
	if (urdu) return { slot: `my ${urdu[1].toLowerCase()}` };
	if (URDU_LIVES.test(sentence)) return { slot: "home" };
	for (const [pattern, slot] of ABOUT_ME) {
		if (pattern.test(sentence)) return { slot };
	}
	return null;
}

const tidy = (text: string) => text.trim().replace(/\s+/g, " ").replace(/[.!,;:]+$/, "");
const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** The lasting facts stated in a message, in the user's own words. */
export function learnedFacts(message: string): Fact[] {
	const facts: Fact[] = [];
	for (const raw of message.match(/[^.!?\n]+[.!?]?/g) ?? []) {
		if (raw.trim().endsWith("?") || SECRET.test(raw)) continue;
		const sentence = tidy(raw.trim().replace(LEAD_IN, ""));
		const asked = sentence.match(REMEMBER)?.[1];
		const text = tidy(asked ?? sentence);
		if (!text || text.length > LONGEST_FACT) continue;
		if (asked) {
			facts.push({ text: capitalise(text), slot: classify(text)?.slot });
			continue;
		}
		if (PASSING.test(text)) continue;
		const known = classify(text);
		if (known) facts.push({ text: capitalise(text), slot: known.slot });
	}
	return facts;
}

/** Add facts to what a friend remembers. When full, the oldest goes first. */
export function mergeMemories(memories: string[], facts: Fact[]): { memories: string[]; added: string[] } {
	let next = [...memories];
	const added: string[] = [];
	for (const { text, slot } of facts) {
		const lower = text.toLowerCase();
		if (next.some((m) => m.toLowerCase() === lower)) continue;
		if (slot) next = next.filter((m) => classify(tidy(m))?.slot !== slot);
		next.push(text);
		added.push(text);
	}
	return { memories: next.slice(-PERSONA_LIMITS.memories), added };
}

/** The same friend with a new memory list and a prompt that includes it. */
export function withMemories(character: Character, memories: string[]): Character {
	if (!character.persona) return character;
	const persona = { ...character.persona, memories };
	const prompt = compilePersona(character.name, character.description ?? "", persona);
	return { ...character, persona, system_prompt: prompt.slice(0, LIMITS.prompt) };
}
