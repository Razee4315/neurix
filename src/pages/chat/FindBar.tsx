import { Icon } from "@/components/ui/Icon";
import { alpha } from "@/theme/alpha";
import { tokens } from "@/theme/tokens";
import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import styled from "styled-components";

/* Find in this chat. Matches are painted with the CSS Highlight API, so the
   messages themselves are never touched or redrawn. Where that isn't
   available the count and the jumping still work. */

const ALL = "neurix-find";
const CURRENT = "neurix-find-current";
const MAX_MATCHES = 500;

const Bar = styled.div`
  position: absolute;
  top: 0.5rem;
  right: 1rem;
  z-index: ${tokens.zIndex.content};
  display: flex;
  align-items: center;
  gap: 0.125rem;
  height: 38px;
  padding: 0 0.25rem 0 0.75rem;
  background: ${tokens.colors.surfaceContainerHighest};
  border: 1px solid ${alpha(tokens.colors.outlineVariant, "cc")};
  border-radius: ${tokens.borderRadius.lg};

  @media (max-width: 600px) { left: 0.5rem; right: 0.5rem; }
`;

const Field = styled.input`
  width: 11rem;
  min-width: 0;
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  color: ${tokens.colors.onSurface};
  font-size: ${tokens.typography.fontSize.sm};
  font-family: inherit;

  &::placeholder { color: ${tokens.colors.outline}; }
`;

const Count = styled.span`
  min-width: 3.25rem;
  padding: 0 0.375rem;
  text-align: right;
  font-size: ${tokens.typography.fontSize.xs};
  font-variant-numeric: tabular-nums;
  color: ${tokens.colors.onSurfaceVariant};
  white-space: nowrap;
`;

const Btn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: ${tokens.borderRadius.md};
  background: transparent;
  color: ${tokens.colors.onSurfaceVariant};
  cursor: pointer;

  &:hover:not(:disabled) { background: ${tokens.colors.surfaceBright}; color: ${tokens.colors.onSurface}; }
  &:disabled { opacity: 0.4; cursor: default; }
`;

/** Every place `query` occurs in `text`, ignoring case. */
export function matchOffsets(text: string, query: string): number[] {
	const haystack = text.toLowerCase();
	const needle = query.toLowerCase();
	const found: number[] = [];
	if (!needle) return found;
	for (let at = haystack.indexOf(needle); at >= 0; at = haystack.indexOf(needle, at + needle.length)) {
		found.push(at);
	}
	return found;
}

function findRanges(root: HTMLElement, query: string): Range[] {
	const ranges: Range[] = [];
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	for (let node = walker.nextNode(); node && ranges.length < MAX_MATCHES; node = walker.nextNode()) {
		for (const start of matchOffsets(node.nodeValue ?? "", query)) {
			const range = new Range();
			range.setStart(node, start);
			range.setEnd(node, start + query.length);
			ranges.push(range);
			if (ranges.length === MAX_MATCHES) break;
		}
	}
	return ranges;
}

const canHighlight = () => typeof CSS !== "undefined" && "highlights" in CSS && typeof Highlight !== "undefined";

function paint(ranges: Range[], current: number) {
	if (!canHighlight()) return;
	CSS.highlights.set(ALL, new Highlight(...ranges));
	const active = ranges[current];
	if (active) CSS.highlights.set(CURRENT, new Highlight(active));
	else CSS.highlights.delete(CURRENT);
}

function clearPaint() {
	if (!canHighlight()) return;
	CSS.highlights.delete(ALL);
	CSS.highlights.delete(CURRENT);
}

interface FindBarProps {
	root: RefObject<HTMLElement>;
	/** Changes whenever the messages do, so matches are looked for again. */
	version: number;
	onClose: () => void;
}

export function FindBar({ root, version, onClose }: FindBarProps) {
	const [query, setQuery] = useState("");
	const [count, setCount] = useState(0);
	const [current, setCurrent] = useState(0);
	const rangesRef = useRef<Range[]>([]);
	const fieldRef = useRef<HTMLInputElement>(null);

	const show = useCallback((index: number) => {
		const ranges = rangesRef.current;
		paint(ranges, index);
		const target = ranges[index]?.startContainer.parentElement;
		target?.scrollIntoView({ block: "center" });
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: `version` marks a change in the messages
	useEffect(() => {
		const el = root.current;
		const ranges = el && query ? findRanges(el, query) : [];
		rangesRef.current = ranges;
		setCount(ranges.length);
		setCurrent(0);
		if (ranges.length > 0) show(0);
		else clearPaint();
	}, [query, version, root, show]);

	useEffect(() => {
		fieldRef.current?.focus();
		return clearPaint;
	}, []);

	const step = (by: number) => {
		if (count === 0) return;
		const next = (current + by + count) % count;
		setCurrent(next);
		show(next);
	};

	const onKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Escape") {
			e.preventDefault();
			onClose();
		} else if (e.key === "Enter") {
			e.preventDefault();
			step(e.shiftKey ? -1 : 1);
		}
	};

	return (
		<Bar role="search">
			<Field
				ref={fieldRef}
				value={query}
				placeholder="Find in this chat"
				aria-label="Find in this chat"
				onChange={(e) => setQuery(e.target.value)}
				onKeyDown={onKeyDown}
				spellCheck={false}
				autoComplete="off"
			/>
			<Count aria-live="polite">{query ? (count > 0 ? `${current + 1} of ${count}` : "None") : ""}</Count>
			<Btn type="button" aria-label="Previous match" disabled={count === 0} onClick={() => step(-1)}>
				<Icon name="arrow_upward" size={14} />
			</Btn>
			<Btn type="button" aria-label="Next match" disabled={count === 0} onClick={() => step(1)}>
				<Icon name="arrow_downward" size={14} />
			</Btn>
			<Btn type="button" aria-label="Close find" onClick={onClose}>
				<Icon name="close" size={14} />
			</Btn>
		</Bar>
	);
}
