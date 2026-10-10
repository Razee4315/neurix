import { describe, expect, it } from "vitest";
import { cleanResponse } from "./cleanResponse";

describe("cleanResponse", () => {
	it("returns input unchanged when no stop tokens are present", () => {
		expect(cleanResponse("Hello, world.")).toBe("Hello, world.");
	});

	it("trims leading and trailing whitespace", () => {
		expect(cleanResponse("  spaced out  ")).toBe("spaced out");
	});

	it("keeps lines that begin with a role label", () => {
		// A script, an interview or a chat log is ordinary output. The engine
		// ends a reply at the model's end-of-turn token, not on guessed text.
		const script = "Here is the dialogue:\nUser: Hi there\nAssistant: Hello!\nHuman: Bye";
		expect(cleanResponse(script)).toBe(script);
	});

	it("keeps role-like words that are not at the start of a line", () => {
		const text = "Ask the user: what do they need?";
		expect(cleanResponse(text)).toBe(text);
	});

	it("keeps lowercase and indented keys such as YAML", () => {
		const yaml = "db:\n  user: admin\n  port: 5432";
		expect(cleanResponse(yaml)).toBe(yaml);
		expect(cleanResponse("config\nuser: admin")).toBe("config\nuser: admin");
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

	it("strips <|endoftext|> markers", () => {
		expect(cleanResponse("Reply<|endoftext|>extra")).toBe("Reply");
	});

	it("drops everything after the first template token", () => {
		expect(cleanResponse("Real reply.<|im_end|>\n<|im_start|>user\nleak")).toBe("Real reply.");
	});

	it("returns empty string when input is only stop tokens", () => {
		expect(cleanResponse("<|endoftext|>")).toBe("");
	});
});
