import { type RefObject, useEffect } from "react";

const FOCUSABLE =
	'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Keep keyboard focus inside a dialog or sheet while it is open, and return
 * it to whatever was focused before when it closes.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean) {
	useEffect(() => {
		const container = ref.current;
		if (!active || !container) return;

		const previouslyFocused = document.activeElement as HTMLElement | null;
		const focusables = () =>
			Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
				(el) => el.offsetParent !== null,
			);

		// Move focus in, unless something inside already has it (autoFocus).
		if (!container.contains(document.activeElement)) {
			(focusables()[0] ?? container).focus();
		}

		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key !== "Tab") return;
			const items = focusables();
			if (items.length === 0) {
				e.preventDefault();
				return;
			}
			const first = items[0];
			const last = items[items.length - 1];
			const current = document.activeElement;
			if (e.shiftKey && (current === first || !container.contains(current))) {
				e.preventDefault();
				last.focus();
			} else if (!e.shiftKey && (current === last || !container.contains(current))) {
				e.preventDefault();
				first.focus();
			}
		};

		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("keydown", onKeyDown);
			previouslyFocused?.focus?.();
		};
	}, [ref, active]);
}
