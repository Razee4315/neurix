import { modelService } from "@/services";
import type { ModelInfo } from "@/services/types";
import { useEffect, useState } from "react";

/**
 * Resolve the model a page is about: from router state when available (fast
 * first paint), otherwise by looking the `?id=` up in the catalog so the
 * page survives a reload or a direct link.
 */
export function useCatalogModel(stateModel: ModelInfo | undefined, id: string | null) {
	const [model, setModel] = useState<ModelInfo | null>(stateModel ?? null);
	const [lookupFailed, setLookupFailed] = useState(false);

	useEffect(() => {
		if (model || !id) return;
		let cancelled = false;
		modelService.getCatalog()
			.then((catalog) => {
				if (cancelled) return;
				const found = catalog.find((m) => m.id === id);
				if (found) setModel(found);
				else setLookupFailed(true);
			})
			.catch(() => {
				if (!cancelled) setLookupFailed(true);
			});
		return () => {
			cancelled = true;
		};
	}, [model, id]);

	return { model, lookupFailed };
}
