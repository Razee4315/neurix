import type { Message, MessageVariant } from "./messages";

/**
 * Branches in a chat, kept as plain data on the message they hang from.
 *
 * - An AI reply keeps every answer it was given (Retry adds one) in
 *   `variants`; the message's own fields always mirror the active one, so
 *   history, export and saving never need to know branches exist.
 * - A user message keeps every wording it had (Edit adds one). Each wording
 *   carries the rest of the chat that followed it in `tail`, so switching
 *   back restores those replies too.
 *
 * Every helper is pure and returns the same object when nothing changes.
 */

/** The variant a message shows now, read from the message itself. */
function snapshot(message: Message, tail?: Message[]): MessageVariant {
	return {
		text: message.text,
		...(message.reasoning ? { reasoning: message.reasoning } : {}),
		...(message.thoughtMs ? { thoughtMs: message.thoughtMs } : {}),
		...(message.sources?.length ? { sources: message.sources } : {}),
		...(message.stopReason ? { stopReason: message.stopReason } : {}),
		...(tail ? { tail } : {}),
	};
}

/** Every variant of a message, the single-answer case included. */
export function variantsOf(message: Message): MessageVariant[] {
	return message.variants && message.variants.length > 0 ? message.variants : [snapshot(message)];
}

/** Which variant is showing, clamped into range. */
export function activeIndexOf(message: Message): number {
	const count = variantsOf(message).length;
	const index = message.activeVariant ?? count - 1;
	return Math.min(Math.max(index, 0), count - 1);
}

/** How many variants a message has (1 when it was never branched). */
export function variantCount(message: Message): number {
	return message.variants?.length ?? 1;
}

/** The message showing variant `index`, with its fields copied up. */
function showVariant(message: Message, variants: MessageVariant[], index: number): Message {
	const v = variants[index];
	const { reasoning: _r, thoughtMs: _t, sources: _s, stopReason: _sr, ...rest } = message;
	return {
		...rest,
		text: v.text,
		...(v.reasoning ? { reasoning: v.reasoning } : {}),
		...(v.thoughtMs ? { thoughtMs: v.thoughtMs } : {}),
		...(v.sources?.length ? { sources: v.sources } : {}),
		...(v.stopReason ? { stopReason: v.stopReason } : {}),
		variants,
		activeVariant: index,
	};
}

/**
 * A new answer to the same prompt (Retry), kept beside the earlier ones.
 * The earlier answers are never lost; the new one becomes active.
 */
export function addReplyVariant(previous: Message, reply: Message): Message {
	const kept = variantsOf(previous).map((v, i) => (i === activeIndexOf(previous) ? snapshot(previous) : v));
	const variants = [...kept, snapshot(reply)];
	return showVariant({ ...reply, characterId: reply.characterId ?? previous.characterId }, variants, variants.length - 1);
}

/** The active answer was extended (Continue): it replaces itself in place. */
export function replaceActiveVariant(previous: Message, reply: Message): Message {
	if (!previous.variants || previous.variants.length < 2) return reply;
	const index = activeIndexOf(previous);
	const variants = previous.variants.map((v, i) => (i === index ? snapshot(reply) : v));
	return showVariant(reply, variants, index);
}

/** Show another answer of an AI reply. */
export function selectReplyVariant(message: Message, index: number): Message {
	const variants = message.variants;
	if (!variants || index < 0 || index >= variants.length || index === activeIndexOf(message)) return message;
	const current = activeIndexOf(message);
	const saved = variants.map((v, i) => (i === current ? snapshot(message) : v));
	return showVariant(message, saved, index);
}

/**
 * A user message was edited and sent again. The old wording and every
 * reply that followed it are kept as a sibling branch; the new wording
 * starts a branch of its own.
 */
export function branchUserEdit(original: Message, tail: Message[], edited: Message): Message {
	const current = activeIndexOf(original);
	const kept = variantsOf(original).map((v, i) => (i === current ? snapshot(original, tail) : v));
	const variants = [...kept, snapshot(edited, [])];
	return { ...edited, variants, activeVariant: variants.length - 1 };
}

/**
 * Switch the user message at `index` to another wording. The replies under
 * the wording being left are saved with it, and the chosen wording's own
 * replies come back.
 */
export function selectUserBranch(messages: Message[], index: number, variant: number): Message[] {
	const target = messages[index];
	if (!target || target.role !== "user" || !target.variants) return messages;
	const current = activeIndexOf(target);
	if (variant === current || variant < 0 || variant >= target.variants.length) return messages;
	const tail = messages.slice(index + 1);
	const variants = target.variants.map((v, i) => (i === current ? { ...v, text: target.text, tail } : v));
	const chosen = variants[variant];
	const switched: Message = { ...target, text: chosen.text, variants, activeVariant: variant };
	return [...messages.slice(0, index), switched, ...(chosen.tail ?? [])];
}

/** Move one step through a message's variants, or null at either end. */
export function stepVariant(message: Message, step: -1 | 1): number | null {
	const next = activeIndexOf(message) + step;
	return next >= 0 && next < variantCount(message) ? next : null;
}
