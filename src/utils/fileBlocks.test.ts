import { describe, expect, it } from "vitest";
import { extractFiles, fenceBareFiles, isHtml, suggestedName } from "./fileBlocks";

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

describe("fenceBareFiles", () => {
	const page = "<!DOCTYPE html>\n<html>\n<body>Hi</body>\n</html>";

	it("wraps a page written with no fence, and keeps what follows it", () => {
		const fixed = fenceBareFiles(`File: index.html\n\n${page}\n\nOpen it in a browser.`);
		const [file] = extractFiles(fixed);
		expect(file).toMatchObject({ name: "index.html", language: "html", code: page, complete: true });
		expect(fixed.endsWith("Open it in a browser.")).toBe(true);
	});

	it("wraps a text file", () => {
		const [file] = extractFiles(fenceBareFiles("File: tips.txt\n\nDrink water.\nCarry a bottle."));
		expect(file).toMatchObject({ name: "tips.txt", code: "Drink water.\nCarry a bottle.", complete: true });
	});

	it("wraps several files", () => {
		const fixed = fenceBareFiles(`File: a.html\n${page}\nFile: b.css\nbody { margin: 0; }`);
		expect(extractFiles(fixed).map((f) => f.name)).toEqual(["a.html", "b.css"]);
	});

	it("marks a page cut off before it ended", () => {
		const [file] = extractFiles(fenceBareFiles("File: index.html\n<html>\n<body>Hi"));
		expect(file.complete).toBe(false);
	});

	it("closes a page the model forgot to close, keeping what follows", () => {
		const fixed = fenceBareFiles(`File: index.html\n\`\`\`html\n${page}\nA clean design.`);
		const [file] = extractFiles(fixed);
		expect(file).toMatchObject({ code: page, complete: true });
		expect(fixed.endsWith("```\nA clean design.")).toBe(true);
	});

	it("closes any file when the model ended the reply itself", () => {
		const text = "File: a.css\n```css\nbody { margin: 0; }";
		expect(extractFiles(fenceBareFiles(text, true))[0].complete).toBe(true);
		expect(extractFiles(fenceBareFiles(text))[0].complete).toBe(false);
	});

	it("leaves a fenced file alone", () => {
		const text = "File: index.html\n```html\n<p>x</p>\n```\nDone.";
		expect(fenceBareFiles(text)).toBe(text);
	});

	it("leaves a file line inside a code block alone", () => {
		const text = "```text\nFile: notes.txt\nsome words\n```";
		expect(fenceBareFiles(text)).toBe(text);
	});

	it("leaves a name with nothing after it alone", () => {
		expect(fenceBareFiles("File: index.html")).toBe("File: index.html");
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
