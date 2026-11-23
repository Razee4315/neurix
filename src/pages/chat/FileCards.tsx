import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { checkWorkspaceFile, openWorkspaceFile, writeWorkspaceFile } from "@/services/fileService";
import { alpha } from "@/theme/alpha";
import { tokens } from "@/theme/tokens";
import { type ProposedFile, extractFiles, isHtml } from "@/utils/fileBlocks";
import { formatBytes } from "@/utils/format";
import { copyText, isMobile } from "@/utils/platform";
import { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { HtmlPreview } from "./HtmlPreview";

/* The approval step of Create mode. The model only proposes a file: nothing
   reaches the disk until it is approved here, and replacing a file asks again. */

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  margin-top: 0.625rem;
`;

const Card = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.625rem;
  padding: 0.625rem 0.75rem;
  background: ${tokens.colors.surfaceContainer};
  border: 1px solid ${alpha(tokens.colors.outlineVariant, "cc")};
  border-radius: ${tokens.borderRadius.lg};
`;

const Info = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 10rem;

  strong {
    font-size: ${tokens.typography.fontSize.sm};
    font-weight: ${tokens.typography.fontWeight.semibold};
    color: ${tokens.colors.onSurface};
    overflow-wrap: anywhere;
  }
`;

const Detail = styled.span<{ $problem?: boolean }>`
  font-size: ${tokens.typography.fontSize.xs};
  color: ${({ $problem }) => ($problem ? tokens.colors.error : tokens.colors.onSurfaceVariant)};
  overflow-wrap: anywhere;
`;

const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
`;

const Btn = styled.button<{ $primary?: boolean }>`
  height: 30px;
  padding: 0 0.625rem;
  border: 1px solid ${({ $primary }) => ($primary ? tokens.colors.primary : alpha(tokens.colors.outlineVariant, "cc"))};
  border-radius: ${tokens.borderRadius.lg};
  background: ${({ $primary }) => ($primary ? tokens.colors.primary : "transparent")};
  color: ${({ $primary }) => ($primary ? tokens.colors.onPrimaryFixed : tokens.colors.onSurface)};
  font-size: ${tokens.typography.fontSize.sm};
  font-weight: ${tokens.typography.fontWeight.medium};
  cursor: pointer;

  &:disabled { opacity: 0.6; cursor: default; }
`;

type Status =
	| { kind: "checking" }
	| { kind: "ready"; exists: boolean }
	| { kind: "refused"; reason: string }
	| { kind: "writing" }
	| { kind: "written"; path: string }
	| { kind: "skipped" };

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

function FileCard({ file, folder }: { file: ProposedFile; folder: string }) {
	const { showToast } = useToast();
	const { showConfirm } = useConfirm();
	const [status, setStatus] = useState<Status>({ kind: "checking" });
	const [previewing, setPreviewing] = useState(false);

	useEffect(() => {
		let alive = true;
		checkWorkspaceFile(folder, file.name)
			.then((exists) => alive && setStatus({ kind: "ready", exists }))
			.catch((err) => alive && setStatus({ kind: "refused", reason: message(err) }));
		return () => {
			alive = false;
		};
	}, [folder, file.name]);

	const create = async (exists: boolean) => {
		if (exists) {
			const ok = await showConfirm({
				title: "Replace this file?",
				message: `${file.name} already exists in this folder. Replacing it can't be undone.`,
				confirmLabel: "Replace",
				cancelLabel: "Keep it",
				danger: true,
			});
			if (!ok) return;
		}
		setStatus({ kind: "writing" });
		try {
			const path = await writeWorkspaceFile(folder, file.name, file.code, exists);
			setStatus({ kind: "written", path });
		} catch (err) {
			setStatus({ kind: "ready", exists });
			showToast(message(err), "error");
		}
	};

	const open = (path: string) => openWorkspaceFile(path).catch((err) => showToast(message(err), "error"));

	const size = `${formatBytes(new Blob([file.code]).size)}, ${file.code.split("\n").length} lines`;
	const detail =
		status.kind === "refused" ? (
			<Detail $problem>{status.reason}</Detail>
		) : !file.complete ? (
			<Detail $problem>The reply stopped before this file finished. Continue it first.</Detail>
		) : status.kind === "written" ? (
			<Detail>Created: {status.path}</Detail>
		) : status.kind === "skipped" ? (
			<Detail>Not created</Detail>
		) : status.kind === "ready" && status.exists ? (
			<Detail $problem>Already exists in {folder}</Detail>
		) : (
			<Detail>
				{size}, to {folder}
			</Detail>
		);

	return (
		<Card>
			<Icon name="description" size={18} color={tokens.colors.primary} />
			<Info>
				<strong>{file.name}</strong>
				{detail}
			</Info>
			<Actions>
				{isHtml(file.language) && (
					<Btn type="button" onClick={() => setPreviewing(true)}>
						Preview
					</Btn>
				)}
				{status.kind === "ready" && file.complete && (
					<>
						<Btn type="button" onClick={() => setStatus({ kind: "skipped" })}>
							Skip
						</Btn>
						<Btn type="button" $primary onClick={() => create(status.exists)}>
							{status.exists ? "Replace" : "Create file"}
						</Btn>
					</>
				)}
				{status.kind === "writing" && (
					<Btn type="button" $primary disabled>
						Creating…
					</Btn>
				)}
				{status.kind === "written" && (
					<Btn type="button" onClick={() => open(status.path)}>
						Open
					</Btn>
				)}
			</Actions>
			{previewing && <HtmlPreview title={file.name} html={file.code} onClose={() => setPreviewing(false)} />}
		</Card>
	);
}

/** One card for each file a Create mode reply proposes. */
export function FileCards({ text, folder }: { text: string; folder: string }) {
	const files = useMemo(() => extractFiles(text, true), [text]);
	if (files.length === 0) return null;
	return (
		<List>
			{files.map((file) => (
				<FileCard key={file.name} file={file} folder={folder} />
			))}
		</List>
	);
}

/* ── Sources ──
   What a grounded reply looked at, as chips under it. A chip opens a quiet
   note with the full location and, for a file on this computer, a way to
   open it. "Looked at" rather than "used": the model may not have needed
   all of it. */

const SourceRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.375rem;
  margin-top: 0.625rem;

  > small {
    font-size: ${tokens.typography.fontSize.xs};
    color: ${tokens.colors.onSurfaceVariant};
  }
`;

const SourceChip = styled.button<{ $open: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 0.3125rem;
  max-width: 16rem;
  height: 26px;
  padding: 0 0.5rem;
  border: 1px solid ${({ $open }) => ($open ? alpha(tokens.colors.primary, "80") : alpha(tokens.colors.outlineVariant, "cc"))};
  border-radius: ${tokens.borderRadius.md};
  background: ${({ $open }) => ($open ? alpha(tokens.colors.primary, "14") : tokens.colors.surfaceContainer)};
  color: ${({ $open }) => ($open ? tokens.colors.primary : tokens.colors.onSurfaceVariant)};
  font-size: ${tokens.typography.fontSize.xs};
  cursor: pointer;
  transition: background ${tokens.transitions.fast}, color ${tokens.transitions.fast}, border-color ${tokens.transitions.fast};

  &:hover { color: ${tokens.colors.onSurface}; }
  &:focus-visible { outline: 2px solid ${tokens.colors.primary}; outline-offset: 2px; }

  > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  > em {
    font-style: normal;
    font-family: ${tokens.typography.fontFamily.mono};
    color: ${tokens.colors.secondary};
    flex-shrink: 0;
  }

  @media (hover: none) { height: 32px; }
`;

const SourceNote = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  width: 100%;
  margin-top: 0.125rem;
  padding: 0.5rem 0.625rem;
  border-left: 2px solid ${alpha(tokens.colors.primary, "80")};
  background: ${tokens.colors.surfaceContainerLow};
  border-radius: 0 ${tokens.borderRadius.md} ${tokens.borderRadius.md} 0;
  font-size: ${tokens.typography.fontSize.xs};
  color: ${tokens.colors.onSurfaceVariant};

  > code {
    flex: 1;
    min-width: 10rem;
    font-family: ${tokens.typography.fontFamily.mono};
    color: ${tokens.colors.onSurface};
    overflow-wrap: anywhere;
  }
`;

const NoteBtn = styled.button`
  height: 26px;
  padding: 0 0.5rem;
  border: 1px solid ${alpha(tokens.colors.outlineVariant, "cc")};
  border-radius: ${tokens.borderRadius.md};
  background: transparent;
  color: ${tokens.colors.onSurface};
  font-size: ${tokens.typography.fontSize.xs};
  cursor: pointer;

  &:hover { background: ${tokens.colors.surfaceContainerHigh}; }
`;

interface Citation {
	raw: string;
	kind: "file" | "mail" | "repo";
	label: string;
	page: string | null;
	location: string;
}

/** What a source string names, and where to find it. */
export function describeSource(raw: string): Citation {
	const pageMatch = raw.match(/(?:\[Page (\d{1,5})\]|#page=(\d{1,5}))\s*$/i);
	const page = pageMatch ? (pageMatch[1] ?? pageMatch[2]) : null;
	const location = pageMatch ? raw.slice(0, pageMatch.index).trim() : raw;
	if (/^gmail\b/i.test(location)) return { raw, kind: "mail", label: "Gmail", page, location };
	if (/^[\w.-]{1,100}\/[\w.-]{1,100}$/.test(location) && !/[\\:]/.test(location)) {
		return { raw, kind: "repo", label: location.split("/")[1], page, location };
	}
	const label = location.split(/[\\/]/).filter(Boolean).pop() ?? location;
	return { raw, kind: "file", label, page, location };
}

const KIND_ICON: Record<Citation["kind"], string> = { file: "description", mail: "mail", repo: "github" };
const KIND_NAME: Record<Citation["kind"], string> = {
	file: "File on this device",
	mail: "Your newest emails",
	repo: "GitHub repository",
};

/** Clickable citations for what a reply looked at. */
export function SourceChips({ sources }: { sources: string[] }) {
	const { showToast } = useToast();
	const [open, setOpen] = useState<string | null>(null);
	const citations = useMemo(() => sources.map(describeSource), [sources]);
	const current = citations.find((c) => c.raw === open) ?? null;
	const isPath = (c: Citation) => c.kind === "file" && /[\\/]/.test(c.location);

	return (
		<SourceRow aria-label="Sources this reply looked at">
			<small>Looked at</small>
			{citations.map((c) => (
				<SourceChip
					key={c.raw}
					type="button"
					$open={open === c.raw}
					aria-expanded={open === c.raw}
					title={c.raw}
					onClick={() => setOpen((v) => (v === c.raw ? null : c.raw))}
				>
					<Icon name={KIND_ICON[c.kind]} size={12} />
					<span>{c.label}</span>
					{c.page && <em>p.{c.page}</em>}
				</SourceChip>
			))}
			{current && (
				<SourceNote role="region" aria-label={`About ${current.label}`}>
					<span>
						{KIND_NAME[current.kind]}
						{current.page ? `, page ${current.page}` : ""}
					</span>
					<code>{current.location}</code>
					<NoteBtn
						type="button"
						onClick={async () => {
							if (await copyText(current.location)) showToast("Copied", "success");
						}}
					>
						Copy
					</NoteBtn>
					{isPath(current) && !isMobile() && (
						<NoteBtn
							type="button"
							onClick={() => openWorkspaceFile(current.location).catch((err) => showToast(message(err), "error"))}
						>
							Open
						</NoteBtn>
					)}
				</SourceNote>
			)}
		</SourceRow>
	);
}
