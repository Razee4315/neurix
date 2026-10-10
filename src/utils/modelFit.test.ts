import type { ModelInfo } from "@/services/types";
import { describe, expect, it } from "vitest";
import { fitSummary, modelFit, nominalRamGb, recommendModel } from "./modelFit";

const GIB = 1024 ** 3;

function model(id: string, extra: Partial<ModelInfo>): ModelInfo {
	return {
		id,
		name: id,
		description: "",
		size_bytes: 1_000_000_000,
		size_label: "1 GB",
		tag: "Balanced",
		hf_repo: "",
		hf_filename: "",
		context_length: 8192,
		company: "",
		parameters: "",
		quantization: "",
		best_for: [],
		min_ram_gb: 4,
		quality: 3,
		speed: 3,
		reasoning: "none",
		released: "2026-01",
		legacy: false,
		...extra,
	};
}

const catalog = [
	model("tiny", { min_ram_gb: 3, quality: 2, speed: 5, size_bytes: 600_000_000 }),
	model("small", { min_ram_gb: 3, quality: 2, speed: 5, size_bytes: 800_000_000 }),
	model("balanced", { min_ram_gb: 4, quality: 3, speed: 4, size_bytes: 1_300_000_000 }),
	model("reasoner", { min_ram_gb: 6, quality: 4, speed: 3, reasoning: "always" }),
	model("smart", { min_ram_gb: 8, quality: 5, speed: 2, size_bytes: 2_700_000_000 }),
	model("huge", { min_ram_gb: 12, quality: 5, speed: 1, size_bytes: 5_000_000_000 }),
	model("old", { min_ram_gb: 2, quality: 5, speed: 5, legacy: true }),
];

describe("nominalRamGb", () => {
	it("rounds the reported memory up to the size the device is sold as", () => {
		expect(nominalRamGb(7.4 * GIB)).toBe(8);
		expect(nominalRamGb(3.6 * GIB)).toBe(4);
		expect(nominalRamGb(8 * GIB)).toBe(8);
	});

	it("is unknown when the platform does not report memory", () => {
		expect(nominalRamGb(null)).toBeNull();
		expect(nominalRamGb(0)).toBeNull();
	});
});

describe("modelFit", () => {
	const smart = catalog[4];

	it("grades a model against the device", () => {
		expect(modelFit(smart, 7.4 * GIB)).toBe("good");
		expect(modelFit(smart, 5.6 * GIB)).toBe("tight");
		expect(modelFit(smart, 3.6 * GIB)).toBe("too_big");
	});

	it("does not guess when memory is unknown", () => {
		expect(modelFit(smart, null)).toBe("unknown");
		expect(fitSummary(smart, null)).toContain("8 GB");
	});
});

describe("recommendModel", () => {
	const pick = (gib: number | null) => recommendModel(catalog, gib === null ? null : gib * GIB)?.id;

	it("leaves headroom rather than picking the largest model that fits", () => {
		expect(pick(7.4)).toBe("balanced");
		expect(pick(5.6)).toBe("balanced");
		expect(pick(11.3)).toBe("smart");
	});

	it("prefers the faster of two equally capable models", () => {
		expect(pick(15.2)).toBe("smart");
	});

	it("falls back to what fits, then to the smallest", () => {
		expect(pick(3.6)).toBe("balanced");
		// Equal ratings: the larger of the two small models.
		expect(pick(2.7)).toBe("small");
		expect(pick(1.5)).toBe("tiny");
	});

	it("assumes a typical computer when memory is unknown", () => {
		expect(pick(null)).toBe("balanced");
	});

	it("never suggests a superseded or always-reasoning model by default", () => {
		for (const gib of [2, 4, 6, 8, 12, 16, 32]) {
			expect(pick(gib)).not.toBe("old");
			expect(pick(gib)).not.toBe("reasoner");
		}
	});

	it("handles an empty catalog", () => {
		expect(recommendModel([], 8 * GIB)).toBeNull();
	});
});
