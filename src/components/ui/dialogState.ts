/**
 * The confirm dialog shows one question at a time: closed or open. A
 * question asked while another is open replaces it, and the one replaced
 * is answered "cancel", so whoever asked it never waits forever.
 * See STATE_MACHINES.md (M7).
 */
export interface OpenDialog<O> {
	options: O;
	resolve: (confirmed: boolean) => void;
}

export type DialogState<O> = OpenDialog<O> | null;

/** Open `next`, settling whatever was open as cancelled. */
export function openDialog<O>(current: DialogState<O>, next: OpenDialog<O>): DialogState<O> {
	current?.resolve(false);
	return next;
}

/** Answer the open dialog and close it. */
export function answerDialog<O>(current: DialogState<O>, confirmed: boolean): DialogState<O> {
	current?.resolve(confirmed);
	return null;
}
