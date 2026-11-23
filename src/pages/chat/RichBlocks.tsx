import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { alpha } from "@/theme/alpha";
import { tokens } from "@/theme/tokens";
import { copyText } from "@/utils/platform";
import { memo, useEffect, useId, useState } from "react";
import styled from "styled-components";

/* Math and diagrams in a reply. Both libraries are large, so each is only
   fetched (from the app's own bundle, never a CDN) the first time a reply
   contains a finished formula or diagram. Anything they can't draw stays as
   the text the model wrote. */

/* ── Math ── */

type KatexModule = typeof import("katex");

let katexLoad: Promise<KatexModule> | null = null;

function loadKatex(): Promise<KatexModule> {
	if (!katexLoad) {
		katexLoad = Promise.all([import("katex"), import("katex/dist/katex.min.css")])
			.then(([mod]) => mod)
			.catch((err) => {
				katexLoad = null;
				throw err;
			});
	}
	return katexLoad;
}

/** KaTeX's own output for a formula, or null when it can't be drawn. */
function renderTex(katex: KatexModule, tex: string, display: boolean): string | null {
	try {
		const html = (katex.default ?? katex).renderToString(tex, {
			displayMode: display,
			trust: false,
			throwOnError: false,
			strict: "ignore",
			output: "htmlAndMathml",
			maxSize: 50,
			maxExpand: 500,
		});
		// With throwOnError off, a bad formula comes back as a red error span.
		return html.includes("katex-error") ? null : html;
	} catch {
		return null;
	}
}

type MathState = { kind: "loading" } | { kind: "ready"; html: string } | { kind: "failed" };

const InlineMathBox = styled.span`
  .katex { font-size: 1.05em; }
`;

const DisplayMathBox = styled.div`
  margin: 0.5rem 0;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 0.25rem 0;

  .katex-display { margin: 0; }
`;

const RawMath = styled.code`
  font-family: ${tokens.typography.fontFamily.mono};
  font-size: 0.85em;
  color: ${tokens.colors.onSurfaceVariant};
`;

export const MathView = memo(function MathView({ tex, display }: { tex: string; display: boolean }) {
	const [state, setState] = useState<MathState>({ kind: "loading" });

	useEffect(() => {
		let alive = true;
		setState({ kind: "loading" });
		loadKatex()
			.then((katex) => {
				if (!alive) return;
				const html = renderTex(katex, tex, display);
				setState(html === null ? { kind: "failed" } : { kind: "ready", html });
			})
			.catch(() => alive && setState({ kind: "failed" }));
		return () => {
			alive = false;
		};
	}, [tex, display]);

	const raw = display ? `$$${tex}$$` : `$${tex}$`;
	if (state.kind !== "ready") {
		return display ? (
			<DisplayMathBox>
				<RawMath>{raw}</RawMath>
			</DisplayMathBox>
		) : (
			<RawMath>{raw}</RawMath>
		);
	}
	// KaTeX escapes the formula and runs with trust off, so this is its own markup only.
	return display ? (
		// biome-ignore lint/security/noDangerouslySetInnerHtml: KaTeX output, trust: false
		<DisplayMathBox role="math" aria-label={tex} dangerouslySetInnerHTML={{ __html: state.html }} />
	) : (
		// biome-ignore lint/security/noDangerouslySetInnerHtml: KaTeX output, trust: false
		<InlineMathBox role="math" aria-label={tex} dangerouslySetInnerHTML={{ __html: state.html }} />
	);
});

/* ── Diagrams ── */

type MermaidApi = (typeof import("mermaid"))["default"];

let mermaidLoad: Promise<MermaidApi> | null = null;

/** Whether the page behind the chat is dark, read from what is painted. */
function prefersDarkDiagrams(): boolean {
	const bg = getComputedStyle(document.body).backgroundColor;
	const rgb = bg.match(/\d+(\.\d+)?/g)?.slice(0, 3).map(Number);
	if (!rgb || rgb.length < 3) return true;
	const [r, g, b] = rgb;
	return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128;
}

function loadMermaid(): Promise<MermaidApi> {
	if (!mermaidLoad) {
		mermaidLoad = import("mermaid")
			.then(({ default: mermaid }) => {
				// Once per app run. Strict: no click handlers, no HTML labels, and
				// the output is sanitized before it is handed back.
				mermaid.initialize({
					startOnLoad: false,
					securityLevel: "strict",
					theme: prefersDarkDiagrams() ? "dark" : "default",
					fontFamily: "inherit",
				});
				return mermaid;
			})
			.catch((err) => {
				mermaidLoad = null;
				throw err;
			});
	}
	return mermaidLoad;
}

/** Diagrams render one at a time: mermaid keeps global state while it draws. */
let renderChain: Promise<unknown> = Promise.resolve();

function renderDiagram(id: string, code: string): Promise<string> {
	const next = renderChain.then(async () => {
		const mermaid = await loadMermaid();
		await mermaid.parse(code);
		const { svg } = await mermaid.render(id, code);
		return svg;
	});
	renderChain = next.catch(() => {});
	return next;
}

type DiagramState = { kind: "loading" } | { kind: "ready"; svg: string } | { kind: "failed" };

const Frame = styled.div`
  margin: 0.5rem 0;
  background: ${tokens.colors.surfaceContainerLowest};
  border: 1px solid ${tokens.colors.outlineVariant};
  border-radius: ${tokens.borderRadius.lg};
  overflow: hidden;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem 0.25rem 0.125rem 0.75rem;
  min-height: 32px;
  font-size: ${tokens.typography.fontSize.xs};
  font-weight: ${tokens.typography.fontWeight.medium};
  color: ${tokens.colors.onSurfaceVariant};
  background: ${tokens.colors.surfaceContainerHigh};

  > span { margin-right: auto; }
`;

const Segment = styled.div`
  display: inline-flex;
  padding: 2px;
  border-radius: ${tokens.borderRadius.md};
  background: ${tokens.colors.surfaceContainerLowest};
`;

const SegmentBtn = styled.button<{ $on: boolean }>`
  height: 24px;
  padding: 0 0.5rem;
  border: none;
  border-radius: ${tokens.borderRadius.sm};
  background: ${({ $on }) => ($on ? tokens.colors.surfaceContainerHighest : "transparent")};
  color: ${({ $on }) => ($on ? tokens.colors.onSurface : tokens.colors.onSurfaceVariant)};
  font-size: ${tokens.typography.fontSize.xs};
  cursor: pointer;
  transition: background ${tokens.transitions.fast}, color ${tokens.transitions.fast};
`;

const HeaderBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  height: 28px;
  padding: 0 0.5rem;
  border: none;
  border-radius: ${tokens.borderRadius.md};
  background: transparent;
  color: ${tokens.colors.onSurfaceVariant};
  font-size: ${tokens.typography.fontSize.xs};
  cursor: pointer;

  &:hover { background: ${tokens.colors.surfaceBright}; color: ${tokens.colors.onSurface}; }
  &:disabled { opacity: 0.5; cursor: default; }
`;

const Canvas = styled.div`
  display: flex;
  justify-content: center;
  padding: 0.75rem;
  overflow-x: auto;

  svg { max-width: 100%; height: auto; }
`;

const Source = styled.pre`
  margin: 0;
  padding: 0.75rem;
  overflow-x: auto;
  font-family: ${tokens.typography.fontFamily.mono};
  font-size: 0.8rem;
  line-height: 1.55;
  color: ${tokens.colors.onSurface};
`;

const Note = styled.div`
  padding: 0.375rem 0.75rem 0;
  font-size: ${tokens.typography.fontSize.xs};
  color: ${alpha(tokens.colors.onSurfaceVariant, "ee")};
`;

/** A finished ```mermaid block: the drawing, with its source one click away. */
export function MermaidView({ code }: { code: string }) {
	const { showToast } = useToast();
	const [state, setState] = useState<DiagramState>({ kind: "loading" });
	const [view, setView] = useState<"diagram" | "source">("diagram");
	const id = `mmd-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

	useEffect(() => {
		let alive = true;
		setState({ kind: "loading" });
		renderDiagram(id, code)
			.then((svg) => alive && setState({ kind: "ready", svg }))
			.catch(() => {
				// Mermaid leaves its error drawing in the page; take it away.
				document.getElementById(`d${id}`)?.remove();
				if (alive) setState({ kind: "failed" });
			});
		return () => {
			alive = false;
		};
	}, [id, code]);

	const copySvg = async () => {
		if (state.kind !== "ready") return;
		if (await copyText(state.svg)) showToast("Diagram copied as SVG", "success");
		else showToast("Couldn't copy to the clipboard", "error");
	};

	const showSource = view === "source" || state.kind === "failed";
	return (
		<Frame>
			<Header>
				<span>mermaid</span>
				{state.kind !== "failed" && (
					<Segment role="group" aria-label="Show">
						<SegmentBtn type="button" $on={view === "diagram"} aria-pressed={view === "diagram"} onClick={() => setView("diagram")}>
							Diagram
						</SegmentBtn>
						<SegmentBtn type="button" $on={view === "source"} aria-pressed={view === "source"} onClick={() => setView("source")}>
							Source
						</SegmentBtn>
					</Segment>
				)}
				<HeaderBtn type="button" onClick={copySvg} disabled={state.kind !== "ready"} aria-label="Copy diagram as SVG">
					<Icon name="content_copy" size={14} />
					SVG
				</HeaderBtn>
				<HeaderBtn
					type="button"
					aria-label="Copy diagram source"
					onClick={async () => {
						if (await copyText(code)) showToast("Copied", "success");
					}}
				>
					<Icon name="code" size={14} />
					Copy
				</HeaderBtn>
			</Header>
			{state.kind === "failed" && <Note>This diagram couldn't be drawn, so here is what the model wrote.</Note>}
			{showSource ? (
				<Source>{code}</Source>
			) : state.kind === "ready" ? (
				// Rendered with securityLevel "strict", which sanitizes the SVG.
				// biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized by mermaid (strict)
				<Canvas role="img" aria-label="Diagram" dangerouslySetInnerHTML={{ __html: state.svg }} />
			) : (
				<Note role="status">Drawing the diagram…</Note>
			)}
		</Frame>
	);
}
