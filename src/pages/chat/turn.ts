/**
 * One chat turn (getting a model ready, reading sources, the reply) and the
 * messages queued behind it, as one state machine. Pure: ChatPage performs
 * the side effects. See STATE_MACHINES.md (M3).
 *
 * Every reply gets a `runId`. Only events tagged with the run the state is
 * in are applied, so a stopped or superseded run can never touch a newer one.
 */

export interface QueuedMessage {
	id: string;
	text: string;
}

/** What the user asked for, kept so "Try again" after a failed load repeats exactly that. */
export type TurnRequest =
	| { kind: "send"; text: string; fromComposer: boolean }
	/** Regenerate the last reply, or with `extend`, continue it. */
	| { kind: "redo"; extend: boolean };

export type LoadProblem = { kind: "failed"; message: string } | { kind: "no-models" };

export type Turn =
	| { kind: "idle" }
	/** No model was loaded: loading one for this request. */
	| { kind: "preparing"; request: TurnRequest }
	/** The model could not be loaded; the request waits for Try again or Dismiss. */
	| { kind: "load-failed"; request: TurnRequest; problem: LoadProblem }
	/** Reading connected sources (folders, Gmail, GitHub) before asking the model. */
	| { kind: "gathering"; runId: number }
	/** The model was asked; nothing has come back yet. */
	| { kind: "starting"; runId: number }
	/** The model is reading the conversation. */
	| { kind: "reading"; runId: number; percent: number }
	/** Reasoning or answer tokens are arriving. */
	| { kind: "streaming"; runId: number }
	/** Stop was pressed; the model is finishing its current chunk. */
	| { kind: "stopping"; runId: number };

export type RunTurn = Extract<Turn, { runId: number }>;

export interface ChatTurnState {
	turn: Turn;
	queue: QueuedMessage[];
	/** Why the queue is holding its next message, or null when it flows. */
	paused: string | null;
}

export const initialChatTurn: ChatTurnState = { turn: { kind: "idle" }, queue: [], paused: null };

export const PAUSED = {
	failed: "The last reply failed, so the next message is waiting.",
	stopped: "You stopped the reply, so the next message is waiting.",
	noModel: "No model is ready, so the next message is waiting.",
} as const;

export type ChatTurnAction =
	| { type: "PREPARE"; request: TurnRequest }
	| { type: "PREPARE_FAILED"; problem: LoadProblem }
	/** A model is ready but there is nothing left to do with it (the reply to redo is gone). */
	| { type: "CANCEL_PREPARE" }
	/** Close the load-failed screen without retrying. `requeueId` names a queued message put back. */
	| { type: "DISMISS"; requeueId: string }
	| { type: "RUN_STARTED"; runId: number }
	| { type: "INFERENCE_STARTED"; runId: number }
	| { type: "PROMPT_PROGRESS"; runId: number; percent: number }
	| { type: "TOKEN"; runId: number }
	| { type: "STOP" }
	| { type: "RUN_ENDED"; runId: number; failed: boolean }
	| { type: "QUEUE_ADD"; item: QueuedMessage }
	/** Take a message out of the queue (to send it, edit it, or drop it). */
	| { type: "QUEUE_REMOVE"; id: string }
	| { type: "QUEUE_RESUME" };

export function runIdOf(turn: Turn): number | null {
	return "runId" in turn ? turn.runId : null;
}

/** A reply is under way (Stop applies). */
export function isGenerating(turn: Turn): turn is RunTurn {
	return runIdOf(turn) !== null;
}

/** Anything is under way: a new turn must wait (or queue). */
export function isBusy(turn: Turn): boolean {
	return turn.kind !== "idle" && turn.kind !== "load-failed";
}

function withTurn(state: ChatTurnState, turn: Turn): ChatTurnState {
	return { ...state, turn };
}

/** The run this action is about, if the state is still in it. */
function inRun(state: ChatTurnState, runId: number): RunTurn | null {
	return runIdOf(state.turn) === runId ? (state.turn as RunTurn) : null;
}

export function chatTurnReducer(state: ChatTurnState, action: ChatTurnAction): ChatTurnState {
	const { turn } = state;
	switch (action.type) {
		case "PREPARE":
			if (turn.kind !== "idle" && turn.kind !== "load-failed") return state;
			return withTurn(state, { kind: "preparing", request: action.request });

		case "PREPARE_FAILED":
			if (turn.kind !== "preparing") return state;
			return withTurn(state, { kind: "load-failed", request: turn.request, problem: action.problem });

		case "CANCEL_PREPARE":
			return turn.kind === "preparing" ? withTurn(state, { kind: "idle" }) : state;

		case "DISMISS": {
			if (turn.kind !== "load-failed") return state;
			const { request } = turn;
			// A queued message goes back to the front of the queue, held,
			// rather than vanishing. One typed in the box is still there.
			if (request.kind === "send" && !request.fromComposer) {
				return {
					turn: { kind: "idle" },
					queue: [{ id: action.requeueId, text: request.text }, ...state.queue],
					paused: PAUSED.noModel,
				};
			}
			return withTurn(state, { kind: "idle" });
		}

		case "RUN_STARTED":
			if (turn.kind !== "idle" && turn.kind !== "preparing" && turn.kind !== "load-failed") return state;
			// A new reply is starting, so whatever held the queue is over.
			return { ...state, turn: { kind: "gathering", runId: action.runId }, paused: null };

		case "INFERENCE_STARTED": {
			const run = inRun(state, action.runId);
			if (run?.kind !== "gathering") return state;
			return withTurn(state, { kind: "starting", runId: action.runId });
		}

		case "PROMPT_PROGRESS": {
			const run = inRun(state, action.runId);
			if (run?.kind !== "starting" && run?.kind !== "reading") return state;
			if (run.kind === "reading" && run.percent === action.percent) return state;
			return withTurn(state, { kind: "reading", runId: action.runId, percent: action.percent });
		}

		case "TOKEN": {
			const run = inRun(state, action.runId);
			// Already streaming (or stopping): no change, so no re-render per token.
			if (run?.kind !== "starting" && run?.kind !== "reading") return state;
			return withTurn(state, { kind: "streaming", runId: action.runId });
		}

		case "STOP": {
			const paused = state.queue.length > 0 ? PAUSED.stopped : state.paused;
			switch (turn.kind) {
				case "gathering":
					// The model has not been asked yet: the turn simply ends.
					return { ...state, turn: { kind: "idle" }, paused };
				case "starting":
				case "reading":
				case "streaming":
					return { ...state, turn: { kind: "stopping", runId: turn.runId }, paused };
				default:
					return state;
			}
		}

		case "RUN_ENDED": {
			if (!inRun(state, action.runId)) return state;
			// After a failure, messages queued behind it wait for the user.
			const paused = action.failed && state.queue.length > 0 ? PAUSED.failed : state.paused;
			return { ...state, turn: { kind: "idle" }, paused };
		}

		case "QUEUE_ADD":
			return { ...state, queue: [...state.queue, action.item] };

		case "QUEUE_REMOVE": {
			if (!state.queue.some((q) => q.id === action.id)) return state;
			const queue = state.queue.filter((q) => q.id !== action.id);
			// Nothing left to hold: a stale reason must not greet the next message.
			return { ...state, queue, paused: queue.length > 0 ? state.paused : null };
		}

		case "QUEUE_RESUME":
			return state.paused === null ? state : { ...state, paused: null };
	}
}

/** The queued message to send now, if the chat is free for it. */
export function nextQueued(state: ChatTurnState, modelLoading: boolean): QueuedMessage | null {
	if (state.turn.kind !== "idle" || state.paused !== null || modelLoading) return null;
	return state.queue[0] ?? null;
}
