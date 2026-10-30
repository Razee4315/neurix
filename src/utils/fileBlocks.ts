/**
 * Files proposed in a reply. Small models write this far more reliably than
 * a JSON tool call: a line naming the file, then one code block. Nothing is
 * written from here; the chat shows each file for the user to approve.
 */

export interface ProposedFile {
	name: string;
	language: string;
	code: string;
	/** False when the reply stopped before the code block closed. */
	complete: boolean;
}

/** Added to the system prompt while Create mode is on. */
export const CREATE_INSTRUCTIONS = [
	"You can create files for the user.",
	"For each file, write a line like File: index.html and then the complete file in one code block.",
	"Use short, simple file names. Keep CSS and JavaScript inside the HTML file unless asked otherwise.",
	"Write the whole file with real content, never placeholders. After the code, add one short sentence.",
].join("\n");

/** Room for a whole page: the default reply length is too short for one. */
export const CREATE_MAX_TOKENS = 2048;

const NAMED_LINE = /^\W*(?:file(?:\s*name)?|path)\s*:\s*`?([^\s`*]+\.[a-z0-9]+)`?\W*$/i;
const BARE_NAME = /^\W*`?([\w./\\-]+\.[a-z0-9]+)`?\W*$/i;
const FENCE_NAME = /^[\w+-]*\s+([\w./\\-]+\.[a-z0-9]+)$/i;

/** A name for a code block the model left unnamed, by its language. */
const DEFAULT_NAMES: Record<string, string> = {
	html: "index.html",
	css: "style.css",
	js: "script.js",
	javascript: "script.js",
	ts: "script.ts",
	typescript: "script.ts",
	json: "data.json",
	md: "notes.md",
	markdown: "notes.md",
	txt: "notes.txt",
	text: "notes.txt",
	python: "main.py",
	py: "main.py",
	csv: "data.csv",
	svg: "image.svg",
};

/** A sensible name for saving a code block as a file. */
export function suggestedName(language: string): string {
	return DEFAULT_NAMES[language.trim().split(/\s+/)[0]?.toLowerCase()] ?? "code.txt";
}

export function isHtml(language: string): boolean {
	return /^(html?|xhtml)\b/i.test(language.trim());
}

/**
 * The files a reply proposes. With `fallback`, used in Create mode, a code
 * block with no name still counts when its language has an obvious one.
 */
export function extractFiles(text: string, fallback = false): ProposedFile[] {
	const lines = text.split("\n");
	const files: ProposedFile[] = [];
	const taken = new Set<string>();
	let previous = "";

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line.startsWith("```")) {
			if (line) previous = line;
			continue;
		}

		const info = line.slice(3).trim();
		const body: string[] = [];
		let complete = false;
		for (i += 1; i < lines.length; i++) {
			if (lines[i].trim() === "```") {
				complete = true;
				break;
			}
			body.push(lines[i]);
		}

		const language = info.split(/\s+/)[0] ?? "";
		const named = info.match(FENCE_NAME)?.[1] ?? previous.match(NAMED_LINE)?.[1] ?? previous.match(BARE_NAME)?.[1];
		const known = DEFAULT_NAMES[language.toLowerCase()];
		previous = "";
		const name = named ?? (fallback ? known : undefined);
		if (!name || taken.has(name.toLowerCase())) continue;
		taken.add(name.toLowerCase());
		files.push({ name, language, code: body.join("\n"), complete });
	}
	return files;
}
