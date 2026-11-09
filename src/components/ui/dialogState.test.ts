import { describe, expect, it, vi } from "vitest";
import { answerDialog, openDialog } from "./dialogState";

describe("confirm dialog state", () => {
	it("answers the open question and closes", () => {
		const resolve = vi.fn();
		expect(answerDialog({ options: "q", resolve }, true)).toBeNull();
		expect(resolve).toHaveBeenCalledWith(true);
	});

	it("closing with nothing open does nothing", () => {
		expect(answerDialog(null, false)).toBeNull();
	});

	it("a second question settles the first as cancelled instead of leaving it waiting", () => {
		const first = vi.fn();
		const second = vi.fn();
		const open = openDialog({ options: "first", resolve: first }, { options: "second", resolve: second });
		expect(first).toHaveBeenCalledWith(false);
		expect(second).not.toHaveBeenCalled();
		expect(open?.options).toBe("second");
	});
});
