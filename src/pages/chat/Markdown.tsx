import { Icon } from "@/components/ui/Icon";
import { alpha } from "@/theme/alpha";
import { tokens } from "@/theme/tokens";
import { copyText, vibrate } from "@/utils/platform";
import { openUrl } from "@tauri-apps/plugin-opener";
import { type ReactNode, memo, useState } from "react";
import styled from "styled-components";

/* ── Styles ── */

const Paragraph = styled.p`
  margin: 0 0 0.375rem;
  &:last-child { margin-bottom: 0; }
`;

const Spacer = styled.div`
  height: 0.375rem;
`;

const Bold = styled.strong`
  font-weight: ${tokens.typography.fontWeight.bold};
  color: ${tokens.colors.onSurface};
`;

const InlineCode = styled.code`
  font-family: ${tokens.typography.fontFamily.mono};
  font-size: 0.85em;
  background: ${tokens.colors.surfaceContainerHighest};
  padding: 0.125rem 0.375rem;
  border-radius: ${tokens.borderRadius.md};
  color: ${tokens.colors.primary};
`;

const Link = styled.a`
  color: ${tokens.colors.tertiary};
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
`;

const Heading = styled.div<{ $level: number }>`
  font-family: ${tokens.typography.fontFamily.headline};
  font-weight: ${tokens.typography.fontWeight.bold};
  color: ${tokens.colors.onSurface};
  margin: 0.625rem 0 0.25rem;
  font-size: ${({ $level }) => ($level === 1 ? "1.25em" : $level === 2 ? "1.1em" : "1em")};
  &:first-child { margin-top: 0; }
`;

const ListItem = styled.div<{ $depth: number }>`
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.125rem;
  padding-left: ${({ $depth }) => $depth * 1.125}rem;
  align-items: baseline;
`;

const Marker = styled.span`
  color: ${tokens.colors.primary};
  flex-shrink: 0;
  font-weight: ${tokens.typography.fontWeight.bold};
  min-width: 0.75rem;
`;

const Quote = styled.blockquote`
  margin: 0.375rem 0;
  padding: 0.25rem 0 0.25rem 0.75rem;
  border-left: 3px solid ${alpha(tokens.colors.primary, "66")};
  color: ${tokens.colors.onSurfaceVariant};
`;

const Rule = styled.hr`
  border: none;
  border-top: 1px solid ${tokens.colors.outlineVariant};
  margin: 0.625rem 0;
`;

const TableScroll = styled.div`
  overflow-x: auto;
  margin: 0.5rem 0;
  border: 1px solid ${tokens.colors.outlineVariant};
  border-radius: ${tokens.borderRadius.lg};
`;

const Table = styled.table`
  border-collapse: collapse;
  width: 100%;
  font-size: 0.9em;

  th, td {
    padding: 0.375rem 0.625rem;
    text-align: left;
    border-bottom: 1px solid ${tokens.colors.outlineVariant};
    white-space: nowrap;
  }
  th {
    background: ${tokens.colors.surfaceContainerHighest};
    color: ${tokens.colors.onSurface};
    font-weight: ${tokens.typography.fontWeight.semibold};
  }
  tr:last-child td { border-bottom: none; }
`;

const CodeBlock = styled.div`
  margin: 0.5rem 0;
  background: ${tokens.colors.surfaceContainerLowest};
  border: 1px solid ${tokens.colors.outlineVariant};
  border-radius: ${tokens.borderRadius.lg};
  overflow: hidden;
`;

const CodeHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.125rem 0.25rem 0.125rem 0.75rem;
  min-height: 32px;
  font-size: ${tokens.typography.fontSize.xs};
  font-weight: ${tokens.typography.fontWeight.medium};
  color: ${tokens.colors.onSurfaceVariant};
  background: ${tokens.colors.surfaceContainerHigh};
`;

const CopyBtn = styled.button<{ $copied: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  background: transparent;
  border: none;
  border-radius: ${tokens.borderRadius.md};
  padding: 0.375rem 0.5rem;
  cursor: pointer;
  font-size: ${tokens.typography.fontSize.xs};
  color: ${({ $copied }) => ($copied ? tokens.colors.secondary : tokens.colors.onSurfaceVariant)};
  transition: color ${tokens.transitions.fast}, background ${tokens.transitions.fast};

  &:hover { background: ${tokens.colors.surfaceBright}; color: ${tokens.colors.onSurface}; }
`;

const CodePre = styled.pre`
  font-family: ${tokens.typography.fontFamily.mono};
  font-size: 0.8rem;
  line-height: 1.5;
  padding: 0.75rem;
  margin: 0;
  overflow-x: auto;
  color: ${tokens.colors.onSurface};
  white-space: pre;
`;

/* ── Copy button ── */

function CodeCopyButton({ code }: { code: string }) {
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		if (!(await copyText(code))) return;
		vibrate(5);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<CopyBtn type="button" onClick={handleCopy} $copied={copied} aria-label="Copy code">
			<Icon name={copied ? "check" : "content_copy"} size={14} />
			{copied ? "Copied" : "Copy"}
		</CopyBtn>
	);
}

/* ── Inline parsing ── */

const INLINE = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))/g;

function handleLinkClick(e: React.MouseEvent, url: string) {
	e.preventDefault();
	// Open in the system browser; the app itself never navigates away.
	openUrl(url).catch(() => {});
}

export function renderInline(text: string): ReactNode[] {
	const nodes: ReactNode[] = [];
	let lastIndex = 0;
	let key = 0;

	for (const match of text.matchAll(INLINE)) {
		const index = match.index ?? 0;
		if (index > lastIndex) nodes.push(text.slice(lastIndex, index));
		if (match[2]) nodes.push(<Bold key={key++}>{match[2]}</Bold>);
		else if (match[3]) nodes.push(<em key={key++}>{match[3]}</em>);
		else if (match[4]) nodes.push(<InlineCode key={key++}>{match[4]}</InlineCode>);
		else if (match[5] && match[6]) {
			const url = match[6];
			nodes.push(
				<Link key={key++} href={url} onClick={(e) => handleLinkClick(e, url)}>
					{match[5]}
				</Link>,
			);
		}
		lastIndex = index + match[0].length;
	}
	if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
	return nodes;
}

/* ── Block parsing ── */

const splitRow = (line: string) =>
	line
		.trim()
		.replace(/^\||\|$/g, "")
		.split("|")
		.map((cell) => cell.trim());

const isTableDivider = (line: string | undefined) =>
	line !== undefined && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);

function renderBlocks(text: string): ReactNode[] {
	const parts: ReactNode[] = [];
	const lines = text.split("\n");
	let i = 0;
	let key = 0;

	while (i < lines.length) {
		const line = lines[i];

		// Fenced code. An unclosed fence (still streaming) runs to the end.
		if (line.trimStart().startsWith("```")) {
			const lang = line.trim().slice(3).trim();
			const codeLines: string[] = [];
			i++;
			while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
				codeLines.push(lines[i]);
				i++;
			}
			i++; // skip the closing fence
			const code = codeLines.join("\n");
			parts.push(
				<CodeBlock key={key++}>
					<CodeHeader>
						<span>{lang || "code"}</span>
						<CodeCopyButton code={code} />
					</CodeHeader>
					<CodePre>{code}</CodePre>
				</CodeBlock>,
			);
			continue;
		}

		// Table: a header row followed by a |---|---| divider.
		if (line.includes("|") && isTableDivider(lines[i + 1])) {
			// Columns and rows are positional and never reorder, so their
			// position is a stable identity.
			const columns = splitRow(line).map((text, c) => ({ id: `c${c}`, text }));
			const rows: { id: string; cells: string[] }[] = [];
			i += 2;
			while (i < lines.length && lines[i].includes("|") && lines[i].trim() !== "") {
				rows.push({ id: `r${rows.length}`, cells: splitRow(lines[i]) });
				i++;
			}
			parts.push(
				<TableScroll key={key++}>
					<Table>
						<thead>
							<tr>
								{columns.map((col) => (
									<th key={col.id}>{renderInline(col.text)}</th>
								))}
							</tr>
						</thead>
						<tbody>
							{rows.map((row) => (
								<tr key={row.id}>
									{columns.map((col, c) => (
										<td key={col.id}>{renderInline(row.cells[c] ?? "")}</td>
									))}
								</tr>
							))}
						</tbody>
					</Table>
				</TableScroll>,
			);
			continue;
		}

		const heading = line.match(/^(#{1,3})\s+(.+)/);
		if (heading) {
			parts.push(
				<Heading key={key++} $level={heading[1].length}>
					{renderInline(heading[2])}
				</Heading>,
			);
			i++;
			continue;
		}

		if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
			parts.push(<Rule key={key++} />);
			i++;
			continue;
		}

		// Blockquote: consecutive "> " lines form one quote.
		if (/^\s*>\s?/.test(line)) {
			const quoted: string[] = [];
			while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
				quoted.push(lines[i].replace(/^\s*>\s?/, ""));
				i++;
			}
			parts.push(<Quote key={key++}>{renderBlocks(quoted.join("\n"))}</Quote>);
			continue;
		}

		// Lists. Nesting depth comes from leading indentation (2 spaces/level).
		const bullet = line.match(/^(\s*)[-*+]\s+(.+)/);
		const numbered = line.match(/^(\s*)(\d+)[.)]\s+(.+)/);
		if (bullet || numbered) {
			const indent = (bullet ?? numbered)?.[1].length ?? 0;
			parts.push(
				<ListItem key={key++} $depth={Math.min(Math.floor(indent / 2), 4)}>
					<Marker>{numbered ? `${numbered[2]}.` : "•"}</Marker>
					<span>{renderInline(bullet ? bullet[2] : (numbered?.[3] ?? ""))}</span>
				</ListItem>,
			);
			i++;
			continue;
		}

		if (line.trim() === "") {
			parts.push(<Spacer key={key++} />);
		} else {
			parts.push(<Paragraph key={key++}>{renderInline(line)}</Paragraph>);
		}
		i++;
	}

	return parts;
}

/**
 * Renders a model reply. Memoised so finished messages are not re-parsed
 * while a new reply streams in beneath them.
 */
export const Markdown = memo(function Markdown({ text }: { text: string }) {
	return <>{renderBlocks(text)}</>;
});
