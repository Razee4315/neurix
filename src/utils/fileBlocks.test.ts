import { describe, expect, it } from "vitest";
import { extractFiles, isHtml, suggestedName } from "./fileBlocks";

const block = (code: string, lang = "html") => `\`\`\`${lang}\n${code}\n\`\`\``;

describe("extractFiles", () => {
	it("reads a named file", () => {
		const [file] = extractFiles(`Here it is.\n\nFile: index.html\n${block("<h1>Hi</h1>")}\n\nDone.`);
		expect(file).toEqual({ name: "index.html", language: "html", code: "<h1>Hi</h1>", complete: true });
	});

	it.each([
		["**File: index.html**"],
		["File: `index.html`"],
		["### index.html"],
		["`index.html`:"],
		["filename: index.html"],
	])("accepts the way models tend to write it: %s", (label) => {
		expect(extractFiles(`${label}\n${block("x")}`)[0]?.name).toBe("index.html");
	});

	it("reads a name on the code fence", () => {
		expect(extractFiles("```html site/index.html\nx\n```")[0]?.name).toBe("site/index.html");
	});

	it("reads several files in one reply", () => {
		const files = extractFiles(`File: a.html\n${block("a")}\n\nFile: b.css\n${block("b", "css")}`);
		expect(files.map((f) => f.name)).toEqual(["a.html", "b.css"]);
	});

	it("leaves ordinary code blocks alone outside Create mode", () => {
		expect(extractFiles(block("print(1)", "python"))).toEqual([]);
	});

	it("names an unnamed block in Create mode", () => {
		expect(extractFiles(block("<p>x</p>"), true)[0]?.name).toBe("index.html");
		expect(extractFiles(block("ls", "bash"), true)).toEqual([]);
	});

	it("doesn't take a sentence for a file name", () => {
		expect(extractFiles(`This uses Node.js and works well.\n${block("x", "text")}`)).toEqual([]);
	});

	it("flags a reply cut off inside the code", () => {
		const [file] = extractFiles("File: index.html\n```html\n<h1>Hi");
		expect(file.complete).toBe(false);
	});

	it("keeps the first of two files with the same name", () => {
		const files = extractFiles(`File: a.txt\n${block("one", "text")}\nFile: A.TXT\n${block("two", "text")}`);
		expect(files).toHaveLength(1);
		expect(files[0].code).toBe("one");
	});
});

describe("naming helpers", () => {
	it("suggests a name by language", () => {
		expect(suggestedName("html")).toBe("index.html");
		expect(suggestedName("Python")).toBe("main.py");
		expect(suggestedName("")).toBe("code.txt");
	});

	it("recognises HTML", () => {
		expect(isHtml("html")).toBe(true);
		expect(isHtml("markdown")).toBe(false);
	});
});
