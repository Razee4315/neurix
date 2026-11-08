import { AppLayout } from "@/components/layout/AppLayout";
import { Icon } from "@/components/ui/Icon";
import { OfflineBanner } from "@/components/ui/OfflineBanner";
import { modelService, settingsService } from "@/services";
import type { HubFile, HubModel } from "@/services/types";
import { alpha } from "@/theme/alpha";
import { tokens } from "@/theme/tokens";
import { useModelDownload } from "@/utils/useModelDownload";
import { openUrl } from "@tauri-apps/plugin-opener";
import { type FormEvent, useEffect, useState } from "react";
import styled from "styled-components";

/** Hugging Face's list of GGUF chat models, most popular first. */
const BROWSE_URL = "https://huggingface.co/models?library=gguf&pipeline_tag=text-generation&sort=trending";

/* ── Styles ── */

const Page = styled.div`
  max-width: 44rem;
  margin: 0 auto;
  padding: 1.25rem;
`;

const Intro = styled.p`
  font-size: ${tokens.typography.fontSize.base};
  color: ${tokens.colors.onSurfaceVariant};
  line-height: ${tokens.typography.lineHeight.relaxed};
`;

const Steps = styled.ol`
  margin: 0.875rem 0 0;
  padding-left: 1.25rem;
  font-size: ${tokens.typography.fontSize.sm};
  color: ${tokens.colors.onSurfaceVariant};
  line-height: ${tokens.typography.lineHeight.relaxed};

  li + li { margin-top: 0.25rem; }
`;

const BrowseButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  margin-top: 0.875rem;
  min-height: 36px;
  padding: 0 0.875rem;
  border-radius: ${tokens.borderRadius.md};
  border: 1px solid ${tokens.colors.outlineVariant};
  background: transparent;
  color: ${tokens.colors.onSurface};
  font-size: ${tokens.typography.fontSize.sm};
  font-weight: ${tokens.typography.fontWeight.semibold};
  cursor: pointer;

  &:hover { background: ${tokens.colors.surfaceContainerHigh}; }
`;

const Form = styled.form`
  display: flex;
  gap: 0.5rem;
  margin-top: 1.25rem;
`;

const LinkInput = styled.input`
  flex: 1;
  min-width: 0;
  height: 44px;
  padding: 0 0.875rem;
  background: ${tokens.colors.surfaceContainerHighest};
  border: none;
  border-radius: ${tokens.borderRadius.lg};
  font-size: ${tokens.typography.fontSize.base};
  color: ${tokens.colors.onSurface};
  outline: none;

  &::placeholder { color: ${tokens.colors.outline}; }
  &:focus { box-shadow: inset 0 -2px 0 ${tokens.colors.primary}; }
`;

const CheckButton = styled.button`
  flex-shrink: 0;
  height: 44px;
  padding: 0 1.125rem;
  border-radius: ${tokens.borderRadius.lg};
  border: none;
  background: ${tokens.colors.primary};
  color: ${tokens.colors.onPrimaryFixed};
  font-weight: ${tokens.typography.fontWeight.bold};
  font-size: ${tokens.typography.fontSize.sm};
  cursor: pointer;

  &:disabled { opacity: 0.55; cursor: default; }
`;

const Notice = styled.div<{ $tone: "warn" | "info" }>`
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  margin-top: 1rem;
  padding: 0.75rem 0.875rem;
  border-radius: ${tokens.borderRadius.xl};
  font-size: ${tokens.typography.fontSize.sm};
  line-height: ${tokens.typography.lineHeight.relaxed};
  color: ${tokens.colors.onSurface};
  background: ${({ $tone }) => alpha($tone === "warn" ? tokens.colors.error : tokens.colors.tertiary, "14")};
  border: 1px solid ${({ $tone }) => alpha($tone === "warn" ? tokens.colors.error : tokens.colors.tertiary, "40")};

  svg { margin-top: 2px; }
`;

const Result = styled.section`
  margin-top: 1.5rem;
`;

const Author = styled.span`
  font-size: ${tokens.typography.fontSize.sm};
  color: ${tokens.colors.primary};
  font-weight: ${tokens.typography.fontWeight.semibold};
  text-transform: uppercase;
  letter-spacing: ${tokens.typography.letterSpacing.wider};
`;

const RepoName = styled.h2`
  font-family: ${tokens.typography.fontFamily.headline};
  font-size: clamp(1.25rem, 5vw, 1.625rem);
  font-weight: ${tokens.typography.fontWeight.bold};
  color: ${tokens.colors.onSurface};
  margin-top: 0.125rem;
  overflow-wrap: anywhere;
`;

const Facts = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin-top: 0.625rem;
`;

const Fact = styled.span`
  font-size: ${tokens.typography.fontSize.sm};
  padding: 0.25rem 0.5rem;
  border-radius: ${tokens.borderRadius.md};
  background: ${tokens.colors.surfaceContainerHigh};
  color: ${tokens.colors.onSurfaceVariant};
`;

const SectionLabel = styled.h3`
  font-size: ${tokens.typography.fontSize.sm};
  text-transform: uppercase;
  letter-spacing: ${tokens.typography.letterSpacing.widest};
  color: ${tokens.colors.onSurfaceVariant};
  margin: 1.25rem 0 0.5rem 0.25rem;
`;

const Files = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
`;

const FileRow = styled.label<{ $selected: boolean; $disabled: boolean }>`
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  padding: 0.75rem 0.875rem;
  border-radius: ${tokens.borderRadius.lg};
  background: ${tokens.colors.surfaceContainerLow};
  border: 1px solid ${({ $selected }) => ($selected ? tokens.colors.primary : "transparent")};
  cursor: ${({ $disabled }) => ($disabled ? "default" : "pointer")};
  opacity: ${({ $disabled }) => ($disabled ? 0.6 : 1)};

  input { margin-top: 3px; accent-color: ${tokens.colors.primary}; }
`;

const FileMain = styled.div`
  flex: 1;
  min-width: 0;
`;

const FileTop = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  font-weight: ${tokens.typography.fontWeight.semibold};
  color: ${tokens.colors.onSurface};
`;

const FileSize = styled.span`
  flex-shrink: 0;
  font-family: ${tokens.typography.fontFamily.mono};
  font-size: ${tokens.typography.fontSize.sm};
  color: ${tokens.colors.onSurfaceVariant};
`;

const FileName = styled.div`
  font-size: ${tokens.typography.fontSize.xs};
  color: ${tokens.colors.outline};
  overflow-wrap: anywhere;
  margin-top: 0.125rem;
`;

const FileNote = styled.div<{ $severe: boolean }>`
  font-size: ${tokens.typography.fontSize.sm};
  color: ${({ $severe }) => ($severe ? tokens.colors.error : tokens.colors.onSurfaceVariant)};
  margin-top: 0.25rem;
`;

const AddButton = styled.button`
  width: 100%;
  margin-top: 1.25rem;
  padding: 0.875rem;
  border-radius: ${tokens.borderRadius.xl};
  background: ${tokens.colors.primary};
  color: ${tokens.colors.onPrimaryFixed};
  font-size: ${tokens.typography.fontSize.md};
  font-weight: ${tokens.typography.fontWeight.bold};
  border: none;
  cursor: pointer;

  &:disabled { opacity: 0.55; cursor: default; }
`;

const Small = styled.p`
  font-size: ${tokens.typography.fontSize.sm};
  color: ${tokens.colors.onSurfaceVariant};
  line-height: ${tokens.typography.lineHeight.relaxed};
  margin-top: 0.75rem;
`;

/* ── Helpers ── */

function fileNote(file: HubFile, ramGb: number | null): { text: string; severe: boolean } {
	if (file.problem) return { text: file.problem, severe: true };
	switch (file.fit) {
		case "good":
			return { text: `Runs well on this device (${ramGb} GB memory)`, severe: false };
		case "tight":
			return { text: `A tight fit: needs about ${file.min_ram_gb} GB of memory`, severe: false };
		case "too_big":
			return { text: `Needs about ${file.min_ram_gb} GB of memory; it may not load here`, severe: true };
		default:
			return { text: `Needs about ${file.min_ram_gb} GB of memory`, severe: false };
	}
}

function errorText(e: unknown): string {
	if (typeof e === "string") return e;
	if (e instanceof Error) return e.message;
	return "Something went wrong. Try again.";
}

/* ── Page ── */

type Status =
	| { kind: "idle" }
	| { kind: "checking" }
	| { kind: "error"; message: string }
	| { kind: "ready"; model: HubModel };

export function AddModelPage() {
	const download = useModelDownload();
	const [link, setLink] = useState("");
	const [status, setStatus] = useState<Status>({ kind: "idle" });
	const [selected, setSelected] = useState<string | null>(null);
	const [adding, setAdding] = useState(false);
	const [addError, setAddError] = useState<string | null>(null);
	const [deviceMemory, setDeviceMemory] = useState<number | null>(null);

	useEffect(() => {
		settingsService.getDeviceInfo()
			.then((info) => setDeviceMemory(info.total_memory_bytes))
			.catch(() => {});
	}, []);

	const ramGb = deviceMemory ? Math.ceil(deviceMemory / 1024 ** 3) : null;

	const check = async (e: FormEvent) => {
		e.preventDefault();
		if (!link.trim() || status.kind === "checking") return;
		setStatus({ kind: "checking" });
		setAddError(null);
		try {
			const model = await modelService.inspectHfLink(link);
			setSelected(model.selected);
			setStatus({ kind: "ready", model });
		} catch (err) {
			setStatus({ kind: "error", message: errorText(err) });
		}
	};

	const add = async () => {
		if (status.kind !== "ready" || !selected || adding) return;
		setAdding(true);
		setAddError(null);
		try {
			const model = await modelService.addHfModel(status.model.repo, selected);
			const started = await download(model, deviceMemory);
			// Turned down at the "may not run here" question: forget it again.
			if (!started) await modelService.deleteModel(model.id).catch(() => {});
		} catch (err) {
			setAddError(errorText(err));
		} finally {
			setAdding(false);
		}
	};

	const hub = status.kind === "ready" ? status.model : null;
	const chosen = hub?.files.find((f) => f.filename === selected) ?? null;

	return (
		<AppLayout title="Add from Hugging Face" back="/store">
			<OfflineBanner />
			<Page>
				<Intro>
					Neurix can run most chat models published on Hugging Face in the GGUF format, not only the
					ones in the store.
				</Intro>
				<Steps>
					<li>Find a model on Hugging Face. Its name usually ends in &ldquo;GGUF&rdquo;.</li>
					<li>Copy the link of its page, or of one of its .gguf files.</li>
					<li>Paste it below. Neurix checks that it will run on this device before anything downloads.</li>
				</Steps>
				<BrowseButton type="button" onClick={() => openUrl(BROWSE_URL).catch(() => {})}>
					<Icon name="open_in_new" size={14} />
					Browse GGUF models on Hugging Face
				</BrowseButton>

				<Form onSubmit={check}>
					<LinkInput
						type="url"
						inputMode="url"
						autoComplete="off"
						autoCapitalize="off"
						spellCheck={false}
						placeholder="https://huggingface.co/owner/model-GGUF"
						value={link}
						onChange={(e) => setLink(e.target.value)}
						aria-label="Hugging Face link"
					/>
					<CheckButton type="submit" disabled={!link.trim() || status.kind === "checking"}>
						{status.kind === "checking" ? "Checking…" : "Check"}
					</CheckButton>
				</Form>

				{status.kind === "error" && (
					<Notice $tone="warn" role="alert">
						<Icon name="error_outline" size={16} color={tokens.colors.error} />
						<span>{status.message}</span>
					</Notice>
				)}

				{hub && (
					<Result aria-labelledby="hub-name">
						<Author>{hub.author}</Author>
						<RepoName id="hub-name">{hub.name}</RepoName>
						<Facts>
							{hub.parameters && <Fact>{hub.parameters} parameters</Fact>}
							{hub.architecture && <Fact>{hub.architecture}</Fact>}
							{hub.license && <Fact>Licence: {hub.license}</Fact>}
						</Facts>

						{!hub.has_chat_template && (
							<Notice $tone="warn" role="note">
								<Icon name="warning" size={16} color={tokens.colors.error} />
								<span>
									This model has no chat format built in, so it may not hold a conversation well.
									Models with &ldquo;Instruct&rdquo; or &ldquo;it&rdquo; in their name usually do.
								</span>
							</Notice>
						)}

						<SectionLabel>Choose a file</SectionLabel>
						<Files role="radiogroup" aria-label="Files">
							{hub.files.map((file) => {
								const note = fileNote(file, ramGb);
								const disabled = !!file.problem;
								return (
									<FileRow
										key={file.filename}
										$selected={file.filename === selected}
										$disabled={disabled}
									>
										<input
											type="radio"
											name="hub-file"
											value={file.filename}
											checked={file.filename === selected}
											disabled={disabled}
											onChange={() => setSelected(file.filename)}
										/>
										<FileMain>
											<FileTop>
												<span>{file.quantization}</span>
												<FileSize>{file.size_label}</FileSize>
											</FileTop>
											<FileName>{file.filename}</FileName>
											<FileNote $severe={note.severe}>{note.text}</FileNote>
										</FileMain>
									</FileRow>
								);
							})}
						</Files>

						{addError && (
							<Notice $tone="warn" role="alert">
								<Icon name="error_outline" size={16} color={tokens.colors.error} />
								<span>{addError}</span>
							</Notice>
						)}

						<AddButton type="button" onClick={add} disabled={!chosen || adding}>
							{adding ? "Checking the file…" : chosen ? `Download · ${chosen.size_label}` : "Choose a file"}
						</AddButton>
						<Small>
							Models you add come from their own authors on Hugging Face. Neurix doesn&rsquo;t make,
							review or filter them, and you are responsible for how you use them.
						</Small>
					</Result>
				)}
			</Page>
		</AppLayout>
	);
}
