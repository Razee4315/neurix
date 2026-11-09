import { describe, expect, it } from "vitest";
import { type TestRunAction, type TestRunState, idleTestRun, testRunReducer, testRunText } from "./useTestRun";

const run = (...actions: TestRunAction[]): TestRunState => actions.reduce(testRunReducer, idleTestRun);

describe("test run: current behaviour", () => {
	it("streams tokens into the reply and cleans it when complete", () => {
		const s = run(
			{ type: "START", runId: 1 },
			{ type: "TOKEN", runId: 1, token: "Hello" },
			{ type: "TOKEN", runId: 1, token: " there" },
		);
		expect(s).toEqual({ kind: "running", runId: 1, text: "Hello there" });
		const done = testRunReducer(s, { type: "COMPLETE", runId: 1 });
		expect(done.kind).toBe("done");
		expect(testRunText(done)).toBe("Hello there");
	});

	it("an error replaces the reply with the message", () => {
		const s = run({ type: "START", runId: 1 }, { type: "TOKEN", runId: 1, token: "Hi" }, {
			type: "FAILED",
			runId: 1,
			error: "No model loaded",
		});
		expect(s).toEqual({ kind: "failed", error: "No model loaded" });
		expect(testRunText(s)).toBe("");
	});

	it("stop keeps what was written and frees the Try button", () => {
		const s = run({ type: "START", runId: 1 }, { type: "TOKEN", runId: 1, token: "Hi" }, { type: "STOP" });
		expect(s).toEqual({ kind: "stopping", runId: 1, text: "Hi" });
		expect(testRunReducer(s, { type: "COMPLETE", runId: 1 })).toEqual({ kind: "done", text: "Hi" });
	});

	it("a new try starts from an empty reply", () => {
		const s = run({ type: "START", runId: 1 }, { type: "TOKEN", runId: 1, token: "old" }, { type: "COMPLETE", runId: 1 });
		expect(testRunReducer(s, { type: "START", runId: 2 })).toEqual({ kind: "running", runId: 2, text: "" });
	});

	it("reset clears everything", () => {
		expect(run({ type: "START", runId: 1 }, { type: "RESET" })).toEqual(idleTestRun);
	});
});

describe("test run: fixed bugs", () => {
	it("stop then try again: late tokens from the old run stay out of the new reply", () => {
		const s = run(
			{ type: "START", runId: 1 },
			{ type: "STOP" },
			{ type: "START", runId: 2 },
			{ type: "TOKEN", runId: 1, token: "stale" },
			{ type: "TOKEN", runId: 2, token: "fresh" },
		);
		expect(testRunText(s)).toBe("fresh");
	});

	it("stop then try again: the old run finishing does not end the new one", () => {
		const s = run({ type: "START", runId: 1 }, { type: "STOP" }, { type: "START", runId: 2 }, { type: "COMPLETE", runId: 1 });
		expect(s.kind).toBe("running");
	});

	it("an old run's error does not fail the new one", () => {
		const s = run({ type: "START", runId: 1 }, { type: "START", runId: 2 }, { type: "FAILED", runId: 1, error: "busy" });
		expect(s.kind).toBe("running");
	});

	it("after a reset, the run still finishing cannot bring its reply back", () => {
		const s = run({ type: "START", runId: 1 }, { type: "RESET" }, { type: "TOKEN", runId: 1, token: "x" });
		expect(s).toEqual(idleTestRun);
	});
});
