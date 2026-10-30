import type { FolderSearch } from "@/services/connectorService";
import { describe, expect, it } from "vitest";
import { folderBlock, withContext } from "./connectors";

const search = (over: Partial<FolderSearch> = {}, folder: Partial<FolderSearch["folder"]> = {}): FolderSearch => ({
	folder: {
		name: "Notes",
		path: "/notes",
		total_files: 3,
		text_files: ["budget.md", "rota.csv"],
		unreadable: ["report.pdf"],
		partial: false,
		...folder,
	},
	excerpts: [],
	unreadable_matches: [],
	...over,
});

describe("folderBlock", () => {
	it("sends only the passages that match", () => {
		const block = folderBlock(
			search({ excerpts: [{ path: "budget.md", text: "The budget is 48,250." }] }),
			"What is the budget?",
		);
		expect(block).toContain("--- File: budget.md ---\nThe budget is 48,250.");
		expect(block).not.toContain("rota.csv");
	});

	it("costs one line when the files can't help", () => {
		const block = folderBlock(search(), "What is the capital of Japan?");
		expect(block).toBe('Local folder "Notes".\n\nNothing in its files matches this question.');
	});

	it("lists the files when asked about them", () => {
		const block = folderBlock(search(), "List the files in my folder");
		expect(block).toContain("Readable files: budget.md, rota.csv.");
		expect(block).toContain("Files that can't be read: report.pdf.");
	});

	it("says when the file in question can't be read", () => {
		const block = folderBlock(search({ unreadable_matches: ["report.pdf"] }), "What does the report say?");
		expect(block).toContain("report.pdf is in this folder, but that file type can't be read");
	});

	it("says when a huge folder was only partly searched", () => {
		expect(folderBlock(search({}, { partial: true }), "budget")).toContain("only part of it was searched");
	});
});

describe("withContext", () => {
	it("leaves a message alone when no source is on", () => {
		expect(withContext("", "Hello")).toBe("Hello");
	});

	it("tells the model not to guess", () => {
		const prompt = withContext("Some notes", "What is the code?");
		expect(prompt).toContain("Never guess or fill in a blank.");
		expect(prompt.endsWith("My question: What is the code?")).toBe(true);
	});
});
