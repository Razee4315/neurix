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
	"You can create files for the user. Write each file in exactly this format:",
	"",
	"File: index.html",
	"```html",
	"the complete file goes here",
	"```",
	"",
	"Always put the code fences around the file. Use short, simple file names.",
	"Keep CSS and JavaScript inside the HTML file unless asked otherwise.",
	"Write the whole file with real content, never placeholders. After the closing fence, add one short sentence.",
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

/** A fence language for a file, from its extension. */
function languageOf(name: string): string {
	const extension = name.split(".").pop()?.toLowerCase() ?? "";
	return extension === "txt" ? "text" : extension;
}

/**
 * Small models often write "File: index.html" and then the file with no code
 * fence. Add the fences so the reply renders as code and can be approved. A
 * page cut off before </html> keeps an open fence, which marks it unfinished.
 */
export function fenceBareFiles(text: string): string {
	const lines = text.split("\n");
	const out: string[] = [];
	let inFence = false;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line.trim().startsWith("```")) inFence = !inFence;
		const name = inFence ? undefined : line.match(NAMED_LINE)?.[1];
		let next = i + 1;
		while (next < lines.length && lines[next].trim() === "") next++;
		if (!name || next === lines.length || lines[next].trim().startsWith("```")) {
			out.push(line);
			continue;
		}

		const html = /\.html?$/i.test(name);
		const body: string[] = [];
		let closed = !html;
		for (; next < lines.length && !NAMED_LINE.test(lines[next]); next++) {
			body.push(lines[next]);
			if (html && /<\/html>/i.test(lines[next])) {
				closed = true;
				next++;
				break;
			}
		}
		while (body.length > 0 && body[body.length - 1].trim() === "") body.pop();
		out.push(line, `\`\`\`${languageOf(name)}`, ...body, ...(closed ? ["```"] : []));
		i = next - 1;
	}
	return out.join("\n");
}

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
