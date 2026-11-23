import hljs from "highlight.js/lib/core";
import type { LanguageFn } from "highlight.js";

/* The core is loaded on first use, and each grammar only when a code block
   in that language is drawn, so a chat with no code never pays for it and a
   chat in Python never downloads Rust. Every import below is a literal, so
   the bundler can split each grammar into its own small chunk. */

type Loader = () => Promise<{ default: LanguageFn }>;

const LOADERS: Record<string, Loader> = {
	bash: () => import("highlight.js/lib/languages/bash"),
	c: () => import("highlight.js/lib/languages/c"),
	cpp: () => import("highlight.js/lib/languages/cpp"),
	csharp: () => import("highlight.js/lib/languages/csharp"),
	css: () => import("highlight.js/lib/languages/css"),
	diff: () => import("highlight.js/lib/languages/diff"),
	dockerfile: () => import("highlight.js/lib/languages/dockerfile"),
	go: () => import("highlight.js/lib/languages/go"),
	ini: () => import("highlight.js/lib/languages/ini"),
	java: () => import("highlight.js/lib/languages/java"),
	javascript: () => import("highlight.js/lib/languages/javascript"),
	json: () => import("highlight.js/lib/languages/json"),
	kotlin: () => import("highlight.js/lib/languages/kotlin"),
	markdown: () => import("highlight.js/lib/languages/markdown"),
	php: () => import("highlight.js/lib/languages/php"),
	powershell: () => import("highlight.js/lib/languages/powershell"),
	python: () => import("highlight.js/lib/languages/python"),
	ruby: () => import("highlight.js/lib/languages/ruby"),
	rust: () => import("highlight.js/lib/languages/rust"),
	sql: () => import("highlight.js/lib/languages/sql"),
	swift: () => import("highlight.js/lib/languages/swift"),
	typescript: () => import("highlight.js/lib/languages/typescript"),
	xml: () => import("highlight.js/lib/languages/xml"),
	yaml: () => import("highlight.js/lib/languages/yaml"),
};

/** What models write after the fence, mapped to the grammar's name. */
const ALIASES: Record<string, string> = {
	sh: "bash",
	shell: "bash",
	zsh: "bash",
	console: "bash",
	"c++": "cpp",
	cc: "cpp",
	cxx: "cpp",
	hpp: "cpp",
	h: "c",
	cs: "csharp",
	"c#": "csharp",
	patch: "diff",
	docker: "dockerfile",
	golang: "go",
	toml: "ini",
	js: "javascript",
	jsx: "javascript",
	mjs: "javascript",
	cjs: "javascript",
	jsonc: "json",
	kt: "kotlin",
	md: "markdown",
	ps1: "powershell",
	pwsh: "powershell",
	py: "python",
	python3: "python",
	rb: "ruby",
	rs: "rust",
	ts: "typescript",
	tsx: "typescript",
	html: "xml",
	htm: "xml",
	svg: "xml",
	xhtml: "xml",
	yml: "yaml",
};

/** One load per grammar, shared by every block that asks for it. */
const loading = new Map<string, Promise<boolean>>();

/** The grammar's name for a fence label, or null when there is none. */
export function normalizeLanguage(language: string): string | null {
	const label = language.trim().split(/\s+/)[0]?.toLowerCase();
	if (!label) return null;
	const name = ALIASES[label] ?? label;
	return name in LOADERS ? name : null;
}

function ensureLanguage(name: string): Promise<boolean> {
	let pending = loading.get(name);
	if (!pending) {
		pending = LOADERS[name]()
			.then((mod) => {
				hljs.registerLanguage(name, mod.default);
				return true;
			})
			.catch(() => {
				// Not cached as a failure, so a later block can try again.
				loading.delete(name);
				return false;
			});
		loading.set(name, pending);
	}
	return pending;
}

/** Past this, colour isn't worth holding up the screen for. */
const MAX_CHARS = 20_000;

/** Escaped HTML with colour classes, or null for plain text. */
export async function highlightCode(code: string, language: string): Promise<string | null> {
	const name = normalizeLanguage(language);
	if (!name || code.length > MAX_CHARS) return null;
	if (!(await ensureLanguage(name)) || !hljs.getLanguage(name)) return null;
	return hljs.highlight(code, { language: name, ignoreIllegals: true }).value;
}
