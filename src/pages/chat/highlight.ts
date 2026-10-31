import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import css from "highlight.js/lib/languages/css";
import go from "highlight.js/lib/languages/go";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";

/* Loaded on first use, so a chat with no code never pays for it. */

for (const [name, language] of Object.entries({
	bash,
	c,
	cpp,
	css,
	go,
	java,
	javascript,
	json,
	markdown,
	python,
	rust,
	sql,
	typescript,
	xml,
	yaml,
})) {
	hljs.registerLanguage(name, language);
}

/** Past this, colour isn't worth holding up the screen for. */
const MAX_CHARS = 20_000;

/** Escaped HTML with colour classes, or null for an unknown language. */
export function highlightCode(code: string, language: string): string | null {
	const name = language.trim().split(/\s+/)[0]?.toLowerCase();
	if (!name || code.length > MAX_CHARS || !hljs.getLanguage(name)) return null;
	return hljs.highlight(code, { language: name, ignoreIllegals: true }).value;
}
