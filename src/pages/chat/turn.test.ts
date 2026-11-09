import { describe, expect, it } from "vitest";
import {
	type ChatTurnAction,
	type ChatTurnState,
	PAUSED,
	chatTurnReducer,
	initialChatTurn,
	isBusy,
	isGenerating,
	nextQueued,
} from "./turn";

const run = (...actions: ChatTurnAction[]): ChatTurnState => actions.reduce(chatTurnReducer, initialChatTurn);
const send = (text: string, fromComposer = true) => ({ kind: "send" as const, text, fromComposer });
const q = (id: string) => ({ id, text: `msg ${id}` });

/** A reply that has reached the streaming stage. */
const streaming = (runId = 1, base: ChatTurnAction[] = []) =>
	run(
		...base,
		{ type: "RUN_STARTED", runId },
		{ type: "INFERENCE_STARTED", runId },
		{ type: "TOKEN", runId },
	);

describe("chat turn: current behaviour", () => {
	it("a reply goes gathering, starting, reading, streaming, then idle", () => {
		let s = run({ type: "RUN_STARTED", runId: 1 });
		expect(s.turn.kind).toBe("gathering");
		expect(isGenerating(s.turn)).toBe(true);
		s = chatTurnReducer(s, { type: "INFERENCE_STARTED", runId: 1 });
		expect(s.turn.kind).toBe("starting");
		s = chatTurnReducer(s, { type: "PROMPT_PROGRESS", runId: 1, percent: 40 });
		expect(s.turn).toEqual({ kind: "reading", runId: 1, percent: 40 });
		s = chatTurnReducer(s, { type: "TOKEN", runId: 1 });
		expect(s.turn.kind).toBe("streaming");
		s = chatTurnReducer(s, { type: "RUN_ENDED", runId: 1, failed: false });
		expect(s.turn.kind).toBe("idle");
	});

	it("more tokens while streaming change nothing (no re-render per token)", () => {
		const s = streaming();
		expect(chatTurnReducer(s, { type: "TOKEN", runId: 1 })).toBe(s);
	});

	it("loading a model first, then the reply", () => {
		let s = run({ type: "PREPARE", request: send("hi") });
		expect(s.turn.kind).toBe("preparing");
		expect(isBusy(s.turn)).toBe(true);
		expect(isGenerating(s.turn)).toBe(false);
		s = chatTurnReducer(s, { type: "RUN_STARTED", runId: 1 });
		expect(s.turn.kind).toBe("gathering");
	});

	it("no model installed: the problem is shown and the chat is free again", () => {
		const s = run({ type: "PREPARE", request: send("hi") }, { type: "PREPARE_FAILED", problem: { kind: "no-models" } });
		expect(s.turn).toMatchObject({ kind: "load-failed", problem: { kind: "no-models" } });
		expect(isBusy(s.turn)).toBe(false);
		expect(chatTurnReducer(s, { type: "DISMISS", requeueId: "x" }).turn.kind).toBe("idle");
	});

	it("stop during the reply waits for the model to finish its chunk", () => {
		let s = streaming();
		s = chatTurnReducer(s, { type: "STOP" });
		expect(s.turn).toEqual({ kind: "stopping", runId: 1 });
		s = chatTurnReducer(s, { type: "RUN_ENDED", runId: 1, failed: false });
		expect(s.turn.kind).toBe("idle");
	});

	it("queued messages flow one at a time when the chat is free", () => {
		let s = streaming(1, [{ type: "QUEUE_ADD", item: q("a") }, { type: "QUEUE_ADD", item: q("b") }]);
		expect(nextQueued(s, false)).toBeNull();
		s = chatTurnReducer(s, { type: "RUN_ENDED", runId: 1, failed: false });
		expect(nextQueued(s, false)?.id).toBe("a");
		// Not while a model is loading.
		expect(nextQueued(s, true)).toBeNull();
	});

	it("a failed reply holds the queue; Send next releases it", () => {
		let s = streaming(1, [{ type: "QUEUE_ADD", item: q("a") }]);
		s = chatTurnReducer(s, { type: "RUN_ENDED", runId: 1, failed: true });
		expect(s.paused).toBe(PAUSED.failed);
		expect(nextQueued(s, false)).toBeNull();
		s = chatTurnReducer(s, { type: "QUEUE_RESUME" });
		expect(nextQueued(s, false)?.id).toBe("a");
	});

	it("stopping with messages queued holds them", () => {
		const s = chatTurnReducer(streaming(1, [{ type: "QUEUE_ADD", item: q("a") }]), { type: "STOP" });
		expect(s.paused).toBe(PAUSED.stopped);
	});

	it("starting a new reply releases a held queue", () => {
		let s = streaming(1, [{ type: "QUEUE_ADD", item: q("a") }]);
		s = chatTurnReducer(s, { type: "RUN_ENDED", runId: 1, failed: true });
		s = chatTurnReducer(s, { type: "RUN_STARTED", runId: 2 });
		expect(s.paused).toBeNull();
	});
});

describe("chat turn: fixed bugs", () => {
	it("stop while reading sources ends the turn instead of being ignored", () => {
		let s = run({ type: "RUN_STARTED", runId: 1 });
		s = chatTurnReducer(s, { type: "STOP" });
		expect(s.turn.kind).toBe("idle");
		// The sources arrive later: the model is not asked.
		expect(chatTurnReducer(s, { type: "INFERENCE_STARTED", runId: 1 }).turn.kind).toBe("idle");
	});

	it("try again after a failed load keeps the exact request (regenerate, not the composer text)", () => {
		const s = run(
			{ type: "PREPARE", request: { kind: "redo", extend: true } },
			{ type: "PREPARE_FAILED", problem: { kind: "failed", message: "boom" } },
		);
		expect(s.turn).toMatchObject({ kind: "load-failed", request: { kind: "redo", extend: true } });
		// Try again prepares the same request again.
		const retry = chatTurnReducer(s, { type: "PREPARE", request: (s.turn as { request: never }).request });
		expect(retry.turn).toEqual({ kind: "preparing", request: { kind: "redo", extend: true } });
	});

	it("dismissing a failed queued send puts it back at the front of the queue, held", () => {
		const s = run(
			{ type: "QUEUE_ADD", item: q("later") },
			{ type: "PREPARE", request: send("first", false) },
			{ type: "PREPARE_FAILED", problem: { kind: "failed", message: "boom" } },
			{ type: "DISMISS", requeueId: "back" },
		);
		expect(s.queue.map((m) => m.text)).toEqual(["first", "msg later"]);
		expect(s.paused).toBe(PAUSED.noModel);
	});

	it("dismissing a failed composer send leaves the queue alone (the text is still in the box)", () => {
		const s = run(
			{ type: "PREPARE", request: send("typed") },
			{ type: "PREPARE_FAILED", problem: { kind: "failed", message: "boom" } },
			{ type: "DISMISS", requeueId: "x" },
		);
		expect(s.queue).toEqual([]);
		expect(s.paused).toBeNull();
	});

	it("a second turn cannot start while one is preparing (double-tap Regenerate)", () => {
		const s = run({ type: "PREPARE", request: { kind: "redo", extend: false } });
		expect(isBusy(s.turn)).toBe(true);
		expect(chatTurnReducer(s, { type: "PREPARE", request: { kind: "redo", extend: false } })).toBe(s);
	});

	it("events from an older run are ignored", () => {
		let s = streaming(1);
		s = chatTurnReducer(s, { type: "RUN_ENDED", runId: 1, failed: false });
		s = chatTurnReducer(s, { type: "RUN_STARTED", runId: 2 });
		expect(chatTurnReducer(s, { type: "RUN_ENDED", runId: 1, failed: true })).toBe(s);
		expect(chatTurnReducer(s, { type: "TOKEN", runId: 1 })).toBe(s);
	});

	it("emptying the queue clears a stale hold", () => {
		let s = streaming(1, [{ type: "QUEUE_ADD", item: q("a") }]);
		s = chatTurnReducer(s, { type: "RUN_ENDED", runId: 1, failed: true });
		s = chatTurnReducer(s, { type: "QUEUE_REMOVE", id: "a" });
		expect(s.paused).toBeNull();
	});

	it("a prepared turn with nothing left to do frees the chat", () => {
		const s = run({ type: "PREPARE", request: { kind: "redo", extend: false } }, { type: "CANCEL_PREPARE" });
		expect(s.turn.kind).toBe("idle");
	});

	it("a failure with nothing queued does not leave a hold behind", () => {
		const s = chatTurnReducer(streaming(1), { type: "RUN_ENDED", runId: 1, failed: true });
		expect(s.paused).toBeNull();
	});
});
