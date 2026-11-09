import type { ActiveModel } from "@/services/types";
import { describe, expect, it } from "vitest";
import { type ModelAction, type ModelState, activeOf, initialModelState, loadingIdOf, modelReducer } from "./modelMachine";

const model = (id: string): ActiveModel => ({
	id,
	name: id.toUpperCase(),
	reasoning: "none",
	context_length: 4096,
	threads: 4,
});

const run = (...actions: ModelAction[]): ModelState => actions.reduce(modelReducer, initialModelState);

describe("model status: current behaviour", () => {
	it("starts idle and a refresh reports what is loaded", () => {
		expect(initialModelState.status.kind).toBe("idle");
		expect(activeOf(run({ type: "SYNCED", model: model("a") }).status)?.id).toBe("a");
	});

	it("a load ends ready, or idle when it failed", () => {
		const loading = run({ type: "LOAD_STARTED", id: "a", ticket: 1 });
		expect(loadingIdOf(loading.status)).toBe("a");
		expect(activeOf(modelReducer(loading, { type: "LOAD_ENDED", ticket: 1, model: model("a") }).status)?.id).toBe("a");
		expect(modelReducer(loading, { type: "LOAD_ENDED", ticket: 1, model: null }).status.kind).toBe("idle");
	});

	it("unloading syncs back to idle", () => {
		const s = run({ type: "SYNCED", model: model("a") }, { type: "SYNCED", model: null });
		expect(s.status.kind).toBe("idle");
	});
});

describe("model status: fixed bugs", () => {
	it("while switching, the old model is no longer reported as usable", () => {
		const s = run({ type: "SYNCED", model: model("a") }, { type: "LOAD_STARTED", id: "b", ticket: 1 });
		expect(activeOf(s.status)).toBeNull();
		expect(loadingIdOf(s.status)).toBe("b");
	});

	it("the latest request decides, whichever load finishes last", () => {
		const s = run(
			{ type: "LOAD_STARTED", id: "a", ticket: 1 },
			{ type: "LOAD_STARTED", id: "b", ticket: 2 },
			// The first load ends while the second is still queued.
			{ type: "LOAD_ENDED", ticket: 1, model: model("a") },
		);
		expect(loadingIdOf(s.status)).toBe("b");
		expect(activeOf(modelReducer(s, { type: "LOAD_ENDED", ticket: 2, model: model("b") }).status)?.id).toBe("b");
	});

	it("a refresh mid-load does not undo the loading state", () => {
		const s = run({ type: "LOAD_STARTED", id: "a", ticket: 1 }, { type: "SYNCED", model: null });
		expect(loadingIdOf(s.status)).toBe("a");
	});

	it("a load that finishes after the caller gave up is adopted", () => {
		const s = run(
			{ type: "LOAD_STARTED", id: "a", ticket: 1 },
			{ type: "LOAD_ABANDONED", ticket: 1 },
		);
		expect(s.status.kind).toBe("idle");
		expect(activeOf(modelReducer(s, { type: "LOAD_ENDED", ticket: 1, model: model("a") }).status)?.id).toBe("a");
	});

	it("giving up on an old load does not cancel the newer one", () => {
		const s = run(
			{ type: "LOAD_STARTED", id: "a", ticket: 1 },
			{ type: "LOAD_STARTED", id: "b", ticket: 2 },
			{ type: "LOAD_ABANDONED", ticket: 1 },
		);
		expect(loadingIdOf(s.status)).toBe("b");
	});
});
