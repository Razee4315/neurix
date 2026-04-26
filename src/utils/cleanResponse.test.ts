import { describe, expect, it } from "vitest";
import { cleanResponse } from "./cleanResponse";

describe("cleanResponse", () => {
	it("returns input unchanged when no stop tokens are present", () => {
		expect(cleanResponse("Hello, world.")).toBe("Hello, world.");
	});

	it("trims leading and trailing whitespace", () => {
		expect(cleanResponse("  spaced out  ")).toBe("spaced out");
	});

	it("strips a trailing 'Human:' turn", () => {
		expect(cleanResponse("Reply text.\nHuman: ignore me")).toBe("Reply text.");
	});

	it("strips 'User:' regardless of case", () => {
		expect(cleanResponse("Reply.\nuser: hidden")).toBe("Reply.");
	});

	it("strips ChatML <|im_end|> markers", () => {
		expect(cleanResponse("Reply<|im_end|>extra")).toBe("Reply");
	});

	it("strips Gemma <end_of_turn> markers", () => {
		expect(cleanResponse("Reply<end_of_turn>extra")).toBe("Reply");
	});

	it("strips Llama-3 <|eot_id|> markers", () => {
		expect(cleanResponse("Reply<|eot_id|>extra")).toBe("Reply");
	});

	it("strips Phi-3 <|end|> markers", () => {
		expect(cleanResponse("Reply<|end|>extra")).toBe("Reply");
	});

	it("strips <|endoftext|> markers", () => {
		expect(cleanResponse("Reply<|endoftext|>extra")).toBe("Reply");
	});

	it("handles multiple stop patterns in sequence", () => {
		expect(cleanResponse("Real reply.<|im_end|>\nHuman: leak")).toBe("Real reply.");
	});

	it("preserves the body when User: appears in middle of legitimate content", () => {
		// Note: regex matches anchored to end via [\s\S]*$, so once we hit a stop
		// token everything after is dropped. This is intentional — models
		// occasionally emit fake user turns mid-stream that we don't want to keep.
		expect(cleanResponse("Reply.\nUser: garbage")).toBe("Reply.");
	});

	it("returns empty string when input is only stop tokens", () => {
		expect(cleanResponse("<|endoftext|>")).toBe("");
	});
});
