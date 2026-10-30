import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { checkWorkspaceFile, openWorkspaceFile, writeWorkspaceFile } from "@/services/fileService";
import { alpha } from "@/theme/alpha";
import { tokens } from "@/theme/tokens";
import { type ProposedFile, extractFiles, isHtml } from "@/utils/fileBlocks";
import { formatBytes } from "@/utils/format";
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
