import { describe, expect, it } from "vitest";
import { handoffTarget } from "./downloadHandoff";

describe("download hand-off", () => {
	it("a first install opens a chat with the new model", () => {
		expect(handoffTarget(null)).toBe("first-chat");
	});

	it("with a model already loaded, the new one is shown without switching", () => {
		expect(handoffTarget("qwen")).toBe("models");
	});
});
