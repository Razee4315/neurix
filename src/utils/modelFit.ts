import type { ModelInfo } from "@/services/types";

/** How well a model suits the memory of this device. */
export type Fit =
	/** Runs with room to spare. */
	| "good"
	/** Should run, but it uses most of the memory; expect it to be slower. */
	| "tight"
	/** Needs noticeably more memory than the device has. */
	| "too_big"
	/** The device does not report its memory (desktop). */
	| "unknown";

const GIB = 1024 ** 3;

/**
 * The RAM size a device is sold as. A phone advertised with 8 GB reports
 * roughly 7.4 GiB to apps, so the reported figure is rounded up.
 */
export function nominalRamGb(totalMemoryBytes: number | null): number | null {
	if (totalMemoryBytes === null || totalMemoryBytes <= 0) return null;
	return Math.ceil(totalMemoryBytes / GIB);
}

export function modelFit(model: ModelInfo, totalMemoryBytes: number | null): Fit {
	const ram = nominalRamGb(totalMemoryBytes);
	if (ram === null) return "unknown";
	if (ram >= model.min_ram_gb) return "good";
	// One size class below what the model asks for: it loads, but the system
	// has to squeeze other apps out to make room.
	if (ram + 2 >= model.min_ram_gb) return "tight";
	return "too_big";
}

/** Memory assumed when the device does not say (a typical desktop minimum). */
const ASSUMED_RAM_GB = 8;

function better(a: ModelInfo, b: ModelInfo): number {
	return b.quality - a.quality || b.speed - a.speed || b.size_bytes - a.size_bytes;
}

/**
 * The model to suggest first on this device.
 *
 * It prefers a model that leaves a couple of gigabytes free, because a model
 * that only just fits runs slowly and gets the app killed in the background.
 * Models that always reason before answering are left out of the default
 * pick: they are slower to reply, which is a choice rather than a default.
 */
export function recommendModel(
	catalog: ModelInfo[],
	totalMemoryBytes: number | null,
): ModelInfo | null {
	const ram = nominalRamGb(totalMemoryBytes) ?? ASSUMED_RAM_GB;
	const offered = catalog.filter((m) => !m.legacy);
	if (offered.length === 0) return null;
	const everyday = offered.filter((m) => m.reasoning !== "always");
	const pool = everyday.length > 0 ? everyday : offered;

	const comfortable = pool.filter((m) => m.min_ram_gb + 2 <= ram);
	if (comfortable.length > 0) return [...comfortable].sort(better)[0];

	const fits = pool.filter((m) => m.min_ram_gb <= ram);
	if (fits.length > 0) return [...fits].sort(better)[0];

	// Nothing is rated for this little memory: offer the smallest.
	return [...pool].sort((a, b) => a.size_bytes - b.size_bytes)[0];
}

/** One line on why a model does or does not suit this device. */
export function fitSummary(model: ModelInfo, totalMemoryBytes: number | null): string {
	const ram = nominalRamGb(totalMemoryBytes);
	switch (modelFit(model, totalMemoryBytes)) {
		case "good":
			return `Runs well on this device (${ram} GB memory)`;
		case "tight":
			return `A tight fit: built for ${model.min_ram_gb} GB, this device has ${ram} GB`;
		case "too_big":
			return `Needs ${model.min_ram_gb} GB of memory; this device has ${ram} GB`;
		default:
			return `Needs about ${model.min_ram_gb} GB of memory`;
	}
}
