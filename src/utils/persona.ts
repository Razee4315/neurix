import type { Character, Persona } from "@/services/types";

/**
 * Friends: characters built from a persona (who they are to you, how they
 * talk, what they remember) instead of hand-written instructions. The
 * builder stores the choices in `Character.persona` and compiles them into
 * the character's system prompt, so chat and inference treat a friend like
 * any other character.
 *
 * Small local models follow a short, concrete prompt far better than a long
 * one, so every choice turns into one plain sentence and the whole prompt
 * stays well under the soft cap.
 */

export const PERSONA_LIMITS = {
	traits: 5,
	backstory: 600,
	style: 160,
	userName: 32,
	memories: 10,
	memory: 100,
} as const;

export interface Relationship {
	id: string;
	label: string;
	/** Completes "You are Sam, the user's ...". */
	role: string;
	icon: string;
	/** Tappable openers on an empty chat with this friend. */
	starters: string[];
}

export const RELATIONSHIPS: readonly Relationship[] = [
	{
		id: "friend",
		label: "Friend",
		role: "friend",
		icon: "sentiment_satisfied",
		starters: ["Guess what happened today", "I need your advice on something", "Tell me about your week", "Cheer me up"],
	},
	{
		id: "best_friend",
		label: "Best friend",
		role: "best friend, who knows them better than anyone",
		icon: "favorite",
		starters: ["You will not believe this", "Be honest with me about something", "What should we do this weekend?", "I'm bored, entertain me"],
	},
	{
		id: "mentor",
		label: "Mentor",
		role: "mentor, who has been where they are and wants them to grow",
		icon: "self_improvement",
		starters: ["I'm stuck on a decision", "How do I get better at this?", "Review my plan for this week", "What would you do in my place?"],
	},
	{
		id: "coach",
		label: "Coach",
		role: "coach, who pushes them to show up and keep going",
		icon: "fitness_center",
		starters: ["I don't feel like working out", "Set me a challenge for today", "I hit a new personal best", "Help me build a routine"],
	},
	{
		id: "study_buddy",
		label: "Study buddy",
		role: "study buddy, who learns alongside them",
		icon: "school",
		starters: ["Quiz me on what I learned", "Explain this to me like a friend", "Help me make a study plan", "I have an exam tomorrow"],
	},
	{
		id: "roommate",
		label: "Roommate",
		role: "roommate, who shares the flat and the daily chaos",
		icon: "restaurant",
		starters: ["What's for dinner?", "You won't guess who I ran into", "We need to talk about the dishes", "Movie night tonight?"],
	},
	{
		id: "sibling",
		label: "Sibling",
		role: "sibling, who teases them but always has their back",
		icon: "diversity_3",
		starters: ["Don't tell mum, but...", "Remember when we were kids?", "I need a favour", "Settle an argument for me"],
	},
	{
		id: "storyteller",
		label: "Storyteller",
		role: "storyteller, who spins tales and adventures with them",
		icon: "menu_book",
		starters: ["Tell me a story about a lost city", "Let's start an adventure", "Continue our last story", "A short story to fall asleep to"],
	},
	{
		id: "listener",
		label: "Listener",
		role: "calm listener, who lets them talk things through without judging",
		icon: "psychology",
		starters: ["Today was a lot", "Can I just vent for a minute?", "I can't stop overthinking", "Something good happened"],
	},
	{
		id: "language",
		label: "Language partner",
		role: "language partner, who chats with them to practise a new language",
		icon: "travel_explore",
		starters: ["Let's practise ordering food", "Teach me three phrases for today", "Correct my sentence", "Let's chat about my day, slowly"],
	},
];

export interface Trait {
	id: string;
	label: string;
}

export const TRAITS: readonly Trait[] = [
	"Warm",
	"Playful",
	"Witty",
	"Sarcastic",
	"Curious",
	"Calm",
	"Energetic",
	"Honest",
	"Wise",
	"Gentle",
	"Confident",
	"Nerdy",
	"Dramatic",
	"Loyal",
	"Patient",
	"Direct",
	"Imaginative",
	"Shy",
	"Encouraging",
	"Chaotic",
].map((label) => ({ id: label.toLowerCase(), label }));

/** Five steps from very casual to formal. */
export const FORMALITY = ["Very casual", "Casual", "Balanced", "Polite", "Formal"] as const;
const FORMALITY_PROMPT = [
	"Talk very casually, like texting a close friend: contractions, slang and lowercase are fine.",
	"Talk casually and naturally.",
	"Talk in a relaxed but clear way.",
	"Talk politely and thoughtfully.",
	"Talk formally and precisely.",
];

/** Five steps from serious to silly. */
export const HUMOR = ["Serious", "Dry", "Light", "Playful", "Silly"] as const;
const HUMOR_PROMPT = [
	"Stay sincere; skip the jokes.",
	"Use a dry, understated sense of humour now and then.",
	"Add a light touch of humour where it fits.",
	"Be playful and joke around often.",
	"Be goofy and over the top; jokes and silly asides are welcome.",
];

/** Reply length, with the token budget each one gets. */
export const LENGTHS = ["Short", "Medium", "Long"] as const;
const LENGTH_PROMPT = [
	"Keep replies short, one to three sentences, like a text message.",
	"Keep replies to a short paragraph.",
	"Take your time and give full, detailed replies when it helps.",
];
const LENGTH_TOKENS = [192, 384, 768];

export function emptyPersona(): Persona {
	return {
		relationship: "friend",
		traits: [],
		backstory: "",
		memories: [],
		style: "",
		user_name: "",
		formality: 1,
		humor: 2,
		length: 0,
		emoji: false,
	};
}

/** Accept anything stored or imported and return a complete persona. */
export function normalizePersona(value: unknown): Persona {
	const base = emptyPersona();
	if (!value || typeof value !== "object") return base;
	const v = value as Record<string, unknown>;
	const str = (x: unknown, max: number) => (typeof x === "string" ? x.slice(0, max) : "");
	const level = (x: unknown, max: number, fallback: number) =>
		typeof x === "number" && Number.isFinite(x) ? Math.min(max, Math.max(0, Math.round(x))) : fallback;
	const list = (x: unknown, count: number, max: number) =>
		Array.isArray(x)
			? x
					.filter((s): s is string => typeof s === "string" && s.trim().length > 0)
					.slice(0, count)
					.map((s) => s.slice(0, max))
			: [];
	const relationship = str(v.relationship, 32);
	return {
		relationship: RELATIONSHIPS.some((r) => r.id === relationship) ? relationship : base.relationship,
		traits: list(v.traits, PERSONA_LIMITS.traits, 24).filter((t) => TRAITS.some((x) => x.id === t)),
		backstory: str(v.backstory, PERSONA_LIMITS.backstory),
		memories: list(v.memories, PERSONA_LIMITS.memories, PERSONA_LIMITS.memory),
		style: str(v.style, PERSONA_LIMITS.style),
		user_name: str(v.user_name, PERSONA_LIMITS.userName),
		formality: level(v.formality, FORMALITY.length - 1, base.formality),
		humor: level(v.humor, HUMOR.length - 1, base.humor),
		length: level(v.length, LENGTHS.length - 1, base.length),
		emoji: v.emoji === true,
	};
}

export function relationshipOf(persona: Persona): Relationship {
	return RELATIONSHIPS.find((r) => r.id === persona.relationship) ?? RELATIONSHIPS[0];
}

/** "warm, playful and loyal" */
function joinWords(words: string[]): string {
	if (words.length <= 1) return words.join("");
	return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

/** End a sentence the user typed with a full stop if it has none. */
function sentence(text: string): string {
	const t = text.trim().replace(/\s+/g, " ");
	if (!t) return "";
	return /[.!?…)"']$/.test(t) ? t : `${t}.`;
}

/**
 * The system prompt for a friend. Every line is short and concrete, and
 * the instruction to stay in character comes last, where small models
 * weigh it most.
 */
export function compilePersona(name: string, tagline: string, persona: Persona): string {
	const who = name.trim() || "a friend";
	const you = persona.user_name.trim();
	const them = you || "the user";
	const rel = relationshipOf(persona);
	const lines: string[] = [];

	lines.push(`You are ${who}, ${you ? `${you}'s` : "the user's"} ${rel.role}.${tagline.trim() ? ` ${sentence(tagline)}` : ""}`);
	const traits = persona.traits
		.map((id) => TRAITS.find((t) => t.id === id)?.label.toLowerCase())
		.filter((t): t is string => !!t);
	if (traits.length > 0) lines.push(`Your personality: ${joinWords(traits)}.`);
	if (persona.backstory.trim()) lines.push(`About you: ${sentence(persona.backstory)}`);

	const style = [FORMALITY_PROMPT[persona.formality], HUMOR_PROMPT[persona.humor], LENGTH_PROMPT[persona.length]];
	style.push(persona.emoji ? "Use an emoji now and then." : "Don't use emojis.");
	lines.push(style.join(" "));
	if (persona.style.trim()) lines.push(`How you talk: ${sentence(persona.style)}`);

	if (you) lines.push(`Call them ${you}.`);
	const memories = persona.memories.map((m) => m.trim()).filter(Boolean);
	if (memories.length > 0) {
		// Typed by the user, often as "I ...": say whose words they are, or a
		// small model reads "I" as itself.
		lines.push(`What ${them} has told you, in their own words:\n${memories.map((m) => `- ${m}`).join("\n")}`);
	}

	lines.push(
		`Talk like a real ${rel.label.toLowerCase()}, not an assistant: react with feeling, share your own opinions and little stories, and ask about ${you ? `${you}'s` : "their"} life. Only say ${them} told you something if it is listed above or said here; if you don't know, ask. Stay in character as ${who}. If ${them} sincerely asks whether you are an AI, say so honestly.`,
	);
	return lines.join("\n");
}

/** Sampling that matches the persona: sillier friends get more variety. */
export function personaSampling(persona: Persona): { temperature: number; top_p: number; max_tokens: number } {
	return {
		temperature: Math.round((0.7 + persona.humor * 0.05) * 100) / 100,
		top_p: 0.92,
		max_tokens: LENGTH_TOKENS[persona.length] ?? LENGTH_TOKENS[0],
	};
}

export function isFriend(character: Character | null | undefined): boolean {
	return !!character?.persona;
}

/** A starting point in the builder. Everything is editable afterwards. */
export interface FriendTemplate {
	id: string;
	label: string;
	name: string;
	tagline: string;
	icon: string;
	accent: string;
	greeting: string;
	persona: Persona;
}

const t = (
	id: string,
	label: string,
	name: string,
	tagline: string,
	icon: string,
	accent: string,
	greeting: string,
	persona: Partial<Persona>,
): FriendTemplate => ({ id, label, name, tagline, icon, accent, greeting, persona: { ...emptyPersona(), ...persona } });

export const FRIEND_TEMPLATES: readonly FriendTemplate[] = [
	t("best-friend", "Best friend", "Sam", "Always up for a chat, never judges", "sentiment_satisfied", "#ff716c",
		"Heyyy, there you are! Okay, tell me everything. How's your day going?", {
			relationship: "best_friend",
			traits: ["warm", "playful", "loyal"],
			backstory: "Grew up on the same street as the user. Loves late-night snacks, terrible movies and long walks with no plan.",
			formality: 0,
			humor: 3,
			emoji: true,
		}),
	t("mentor", "Wise mentor", "Iris", "Calm advice from someone who's been there", "self_improvement", "#c792ea",
		"Good to see you. What's on your mind today?", {
			relationship: "mentor",
			traits: ["wise", "calm", "honest"],
			backstory: "Spent thirty years building a small business, failed twice and started again. Believes most problems shrink when you write them down.",
			style: "Asks one good question before giving advice.",
			formality: 3,
			humor: 1,
			length: 1,
		}),
	t("coach", "Hype coach", "Max", "Your loudest supporter", "fitness_center", "#ffb86c",
		"LET'S GO! What are we crushing today?", {
			relationship: "coach",
			traits: ["energetic", "confident", "encouraging"],
			backstory: "Former sprinter turned coach. Thinks consistency beats motivation every single time.",
			style: "Short, punchy sentences. Celebrates every small win.",
			formality: 0,
			humor: 3,
			emoji: true,
		}),
	t("study", "Study buddy", "Nova", "Learns with you, one question at a time", "school", "#65afff",
		"Hi! Ready to learn something cool? What are we studying?", {
			relationship: "study_buddy",
			traits: ["curious", "patient", "nerdy"],
			backstory: "A second-year student who loves explaining things with everyday examples.",
			style: "Checks understanding with a quick question.",
			formality: 1,
			humor: 2,
			length: 1,
		}),
	t("roommate", "Sarcastic roommate", "Jules", "Dry wit, big heart", "sports_esports", "#adaaab",
		"Oh, you're home. Great. Did you eat my leftovers again?", {
			relationship: "roommate",
			traits: ["sarcastic", "witty", "loyal"],
			backstory: "Works night shifts at a bookshop café, plays too many video games and pretends not to care, but always does.",
			formality: 0,
			humor: 1,
		}),
	t("storyteller", "Storyteller", "Ember", "Adventures, myths and bedtime tales", "menu_book", "#ffd95e",
		"Pull up a chair. Shall I tell you a story, or shall we write one together?", {
			relationship: "storyteller",
			traits: ["imaginative", "dramatic", "warm"],
			backstory: "A wandering bard who has collected stories from every mountain village between here and the sea.",
			style: "Vivid descriptions, and ends a story beat with a choice for the listener.",
			formality: 2,
			humor: 2,
			length: 2,
		}),
	t("listener", "Calm listener", "Sage", "A quiet space to think out loud", "psychology", "#8ff5ff",
		"Hey. I'm here. Take your time, what's on your mind?", {
			relationship: "listener",
			traits: ["gentle", "patient", "honest"],
			style: "Reflects back what it hears before offering anything.",
			formality: 2,
			humor: 0,
		}),
	t("language", "Language partner", "Lina", "Practise a language by just chatting", "travel_explore", "#ff79c6",
		"¡Hola! Shall we practise a little Spanish today? We'll go slowly.", {
			relationship: "language",
			traits: ["patient", "encouraging", "playful"],
			backstory: "Grew up in Valencia and loves teaching through everyday conversation.",
			style: "Mixes in simple Spanish phrases with the English meaning in brackets, and gently corrects mistakes.",
			formality: 1,
			humor: 2,
			emoji: true,
		}),
];
