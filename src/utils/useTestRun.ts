import { chatService } from "@/services";
import type { InferenceRequest } from "@/services/chatService";
import type { InferenceEvent } from "@/services/types";
import { cleanResponse } from "@/utils/cleanResponse";
import { useCallback, useEffect, useReducer, useRef } from "react";

/**
 * A one-off test reply on the loaded model ("Try it" on the character and
 * friend editors). See STATE_MACHINES.md (M4).
 *
 * Every run gets a number. Events and errors from any run but the current
 * one are dropped, so stopping a reply and trying again can never mix the
 * old reply into the new one, or end the new one early.
 */
export type TestRunState =
	| { kind: "idle" }
	| { kind: "running"; runId: number; text: string }
	/** Stop was pressed; the model is finishing its current chunk. */
	| { kind: "stopping"; runId: number; text: string }
	| { kind: "done"; text: string }
	| { kind: "failed"; error: string };

export type TestRunAction =
	| { type: "START"; runId: number }
	| { type: "TOKEN"; runId: number; token: string }
	| { type: "COMPLETE"; runId: number }
	| { type: "FAILED"; runId: number; error: string }
	| { type: "STOP" }
	| { type: "RESET" };

export const idleTestRun: TestRunState = { kind: "idle" };

function isRun(state: TestRunState, runId: number): state is Extract<TestRunState, { runId: number }> {
	return (state.kind === "running" || state.kind === "stopping") && state.runId === runId;
}

export function testRunReducer(state: TestRunState, action: TestRunAction): TestRunState {
	switch (action.type) {
		case "START":
			return { kind: "running", runId: action.runId, text: "" };
		case "TOKEN":
			if (!isRun(state, action.runId)) return state;
			return { ...state, text: state.text + action.token };
		case "COMPLETE":
			if (!isRun(state, action.runId)) return state;
			return { kind: "done", text: cleanResponse(state.text) || state.text };
		case "FAILED":
			if (!isRun(state, action.runId)) return state;
			return { kind: "failed", error: action.error };
		case "STOP":
			return state.kind === "running" ? { ...state, kind: "stopping" } : state;
		case "RESET":
			return idleTestRun;
	}
}

/** What the reply area shows. */
export function testRunText(state: TestRunState): string {
	return state.kind === "idle" || state.kind === "failed" ? "" : state.text;
}

function errorText(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

export function useTestRun() {
	const [state, dispatch] = useReducer(testRunReducer, idleTestRun);
	const runIdRef = useRef(0);
	const stateRef = useRef(state);
	stateRef.current = state;

	const start = useCallback(async (request: InferenceRequest) => {
		const runId = ++runIdRef.current;
		dispatch({ type: "START", runId });
		const onEvent = (event: InferenceEvent) => {
			switch (event.event) {
				case "TokenGenerated":
					dispatch({ type: "TOKEN", runId, token: event.data.token });
					break;
				case "GenerationComplete":
					dispatch({ type: "COMPLETE", runId });
					break;
				case "Error":
					dispatch({ type: "FAILED", runId, error: event.data.message });
					break;
				// No history is sent, so ContextTrimmed cannot fire; reasoning is not shown.
			}
		};
		try {
			await chatService.runInference(request, onEvent);
		} catch (err) {
			dispatch({ type: "FAILED", runId, error: errorText(err) });
		}
	}, []);

	const stop = useCallback(() => {
		if (stateRef.current.kind !== "running") return;
		chatService.stopInference().catch(() => {});
		dispatch({ type: "STOP" });
	}, []);

	/** Clear the reply, stopping it first if it is still being written. */
	const reset = useCallback(() => {
		if (stateRef.current.kind === "running") chatService.stopInference().catch(() => {});
		dispatch({ type: "RESET" });
	}, []);

	// Stop an in-flight test if the user leaves mid-stream.
	useEffect(() => {
		return () => {
			if (stateRef.current.kind === "running") chatService.stopInference().catch(() => {});
		};
	}, []);

	return {
		state,
		/** A reply is being written and can be stopped. */
		running: state.kind === "running",
		text: testRunText(state),
		error: state.kind === "failed" ? state.error : null,
		start,
		stop,
		reset,
	};
}
