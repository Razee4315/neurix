import { useSyncExternalStore } from "react";

/**
 * The icon style of the active theme.
 *
 * Icons are React components, so their weight cannot come from a CSS
 * variable like the rest of a theme. This is a minimal store the Icon
 * component subscribes to; `applyTheme` updates it.
 */
export type IconWeight = "thin" | "light" | "regular" | "bold" | "fill" | "duotone";

interface IconWeights {
	regular: IconWeight;
	/** Used at small sizes, where fine strokes and two-tone detail blur. */
	small: IconWeight;
}

let current: IconWeights = { regular: "duotone", small: "bold" };
const listeners = new Set<() => void>();

export function setIconWeights(regular: IconWeight, small: IconWeight): void {
	if (current.regular === regular && current.small === small) return;
	current = { regular, small };
	for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

const snapshot = () => current;

export function useIconWeights(): IconWeights {
	return useSyncExternalStore(subscribe, snapshot, snapshot);
}
