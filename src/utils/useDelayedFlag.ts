import { useEffect, useRef, useState } from "react";

/**
 * A status that doesn't flicker: it appears only if the work takes longer
 * than `delay`, and once shown it stays for at least `hold`.
 */
export function useDelayedFlag(active: boolean, delay = 400, hold = 400): boolean {
	const [shown, setShown] = useState(false);
	const shownAt = useRef(0);

	useEffect(() => {
		if (active === shown) return;
		const wait = active ? delay : Math.max(0, hold - (Date.now() - shownAt.current));
		const timer = setTimeout(() => {
			if (active) shownAt.current = Date.now();
			setShown(active);
		}, wait);
		return () => clearTimeout(timer);
	}, [active, shown, delay, hold]);

	return shown;
}
