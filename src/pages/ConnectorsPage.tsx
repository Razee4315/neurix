import { AppLayout } from "@/components/layout/AppLayout";
import { Icon } from "@/components/ui/Icon";
import { EmptyArt } from "@/components/ui/Illustrations";
import { useToast } from "@/components/ui/Toast";
import { useAppContext } from "@/context/AppContext";
import { pickFolder, readFolder } from "@/services/connectorService";
import { alpha } from "@/theme/alpha";
import { tokens } from "@/theme/tokens";
import {
	addDocuments,
	addFolder,
	connectGmail,
	connectRepo,
	disconnectGmail,
	removeDoc,
	removeFolder,
	removeRepo,
	setDocEnabled,
	setFolderEnabled,
	setGmailEnabled,
	setRepoEnabled,
	useConnectors,
} from "@/utils/connectors";
import { isMac, isMobile } from "@/utils/platform";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";

/**
 * Connectors: real working sources the assistant reads from locally.
 * - Local folders (SQLite FTS5 persistent index + PDF/DOCX/Markdown extraction)
 * - Gmail (Read-only IMAP)
 * - GitHub (Public repositories, issues & PRs)
 * - Local Documents (Instant file picker for .txt, .md, .csv, .json)
 */

interface Connector {
	id: "files" | "gmail" | "github";
	name: string;
	icon: string;
	tint: string;
	description: string;
	access: string;
	online?: boolean;
}

const CONNECTORS: Connector[] = [
	{
		id: "files",
		name: "Local folders",
		icon: "folder_open",
		tint: "#1f7a70",
		description:
			"Index folders on this computer with persistent SQLite FTS5 search across Markdown, code, PDF, and DOCX files.",
		access: "Local folders · SQLite FTS5",
	},
	{
		id: "gmail",
		name: "Gmail",
		icon: "mail",
		tint: "#c2463a",
		description:
			"Search and summarise your newest emails locally; draft replies for you to review and send.",
		access: "Gmail · Read-only",
		online: true,
	},
	{
		id: "github",
		name: "GitHub",
		icon: "github",
		tint: "#2b3440",
		description:
			"Read public repository READMEs, open issues, and pull requests directly into your chat context.",
		access: "GitHub · Public repos",
		online: true,
	},
];

const Page = styled.div`
	max-width: 54rem;
	margin: 0 auto;
	padding: 1.5rem 1.25rem 3rem;
`;

const Intro = styled.p`
	margin: 0 0 1.25rem;
	font-size: ${tokens.typography.fontSize.base};
	line-height: 1.6;
	color: ${tokens.colors.onSurfaceVariant};
`;

const AirGapBanner = styled.div`
	display: flex;
	align-items: center;
	justify-content: space-between;
	flex-wrap: wrap;
	gap: 0.75rem;
	margin-bottom: 1.125rem;
	padding: 0.8rem 1rem;
	border-radius: ${tokens.borderRadius.lg};
	background: ${alpha(tokens.colors.secondary, "14")};
	border: 1px solid ${alpha(tokens.colors.secondary, "45")};
	color: ${tokens.colors.onSurface};
	font-size: ${tokens.typography.fontSize.sm};
	line-height: 1.45;
`;

const AirGapText = styled.div`
	display: flex;
	align-items: flex-start;
	gap: 0.5rem;
	flex: 1;
	min-width: 14rem;

	strong {
		font-weight: ${tokens.typography.fontWeight.bold};
		color: ${tokens.colors.secondary};
	}
`;

const AirGapBtn = styled.button`
	padding: 0.375rem 0.75rem;
	border-radius: ${tokens.borderRadius.md};
	border: 1px solid ${tokens.colors.outlineVariant};
	background: ${tokens.colors.surfaceContainerHigh};
	color: ${tokens.colors.onSurface};
	font-size: ${tokens.typography.fontSize.xs};
	font-weight: ${tokens.typography.fontWeight.semibold};
	cursor: pointer;

	&:hover {
		background: ${tokens.colors.surfaceContainerHighest};
	}
`;

const Grid = styled.div`
	display: grid;
	grid-template-columns: 1fr;
	gap: 0.75rem;

	@media (min-width: 720px) {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}
`;

const Card = styled.div<{ $expanded?: boolean }>`
	display: flex;
	flex-direction: column;
	justify-content: space-between;
	gap: 0.75rem;
	padding: 1rem;
	background: ${tokens.colors.surfaceContainerLow};
	border: 1px solid ${tokens.colors.outlineVariant};
	border-radius: ${tokens.borderRadius.xl};
	transition: border-color ${tokens.transitions.fast};

	${({ $expanded }) =>
		$expanded &&
		`
		@media (min-width: 720px) {
			grid-column: 1 / -1;
		}
	`}

	&:hover {
		border-color: ${tokens.colors.outline};
	}
`;

const CardTop = styled.div`
	display: flex;
	align-items: center;
	gap: 0.75rem;
`;

const Tile = styled.span<{ $tint: string }>`
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 36px;
	height: 36px;
	border-radius: ${tokens.borderRadius.lg};
	background: ${({ $tint }) => $tint};
	color: #ffffff;
	flex-shrink: 0;
`;

const Name = styled.div`
	display: flex;
	flex-direction: column;
	min-width: 0;
	flex: 1;

	strong {
		font-size: ${tokens.typography.fontSize.base};
		font-weight: ${tokens.typography.fontWeight.semibold};
		color: ${tokens.colors.onSurface};
	}

	span {
		font-family: ${tokens.typography.fontFamily.mono};
		font-size: 11px;
		color: ${tokens.colors.onSurfaceVariant};
	}
`;

const Description = styled.p`
	margin: 0;
	font-size: ${tokens.typography.fontSize.sm};
	line-height: 1.5;
	color: ${tokens.colors.onSurfaceVariant};
`;

const ConnectBtn = styled.button`
	height: 32px;

	@media (pointer: coarse) {
		height: 36px;
		padding: 0 0.875rem;
	}

	padding: 0 0.75rem;
	border: 1px solid ${tokens.colors.outlineVariant};
	border-radius: ${tokens.borderRadius.lg};
	background: ${tokens.colors.surfaceContainerHigh};
	color: ${tokens.colors.onSurface};
	font-size: ${tokens.typography.fontSize.sm};
	font-weight: ${tokens.typography.fontWeight.semibold};
	cursor: pointer;
	flex-shrink: 0;
	transition: background ${tokens.transitions.fast};

	&:hover:not(:disabled) {
		background: ${tokens.colors.surfaceContainerHighest};
	}
	&:disabled {
		opacity: 0.55;
		cursor: default;
	}
`;

const Badge = styled.span`
	display: inline-flex;
	align-items: center;
	gap: 0.25rem;
	height: 24px;
	padding: 0 0.5rem;
	border-radius: ${tokens.borderRadius.circle};
	background: ${alpha(tokens.colors.secondary, "1f")};
	color: ${tokens.colors.secondary};
	font-family: ${tokens.typography.fontFamily.mono};
	font-size: 11px;
	font-weight: ${tokens.typography.fontWeight.semibold};
	flex-shrink: 0;
`;

const DocsStrip = styled.div`
	display: flex;
	align-items: center;
	justify-content: space-between;
	flex-wrap: wrap;
	gap: 0.75rem;
	margin-top: 0.75rem;
	padding: 0.875rem 1rem;
	border-radius: ${tokens.borderRadius.xl};
	background: ${tokens.colors.surfaceContainerLow};
	border: 1px solid ${tokens.colors.outlineVariant};
`;

const DocsStripLeft = styled.div`
	display: flex;
	align-items: center;
	gap: 0.75rem;
	min-width: 0;
	flex: 1;
`;

const DocsStripActions = styled.div`
	display: flex;
	align-items: center;
	gap: 0.5rem;
`;

const Heading = styled.h2`
	margin: 1.5rem 0 0.625rem;
	font-size: 11px;
	font-weight: ${tokens.typography.fontWeight.bold};
	text-transform: uppercase;
	letter-spacing: 0.12em;
	color: ${tokens.colors.onSurfaceVariant};
`;

const FolderList = styled.div`
	display: flex;
	flex-direction: column;
	border: 1px solid ${tokens.colors.outlineVariant};
	border-radius: ${tokens.borderRadius.xl};
	overflow: hidden;
`;

const FolderRow = styled.div`
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 0.75rem;
	padding: 0.75rem 1rem;
	background: ${tokens.colors.surfaceContainerLow};

	& + & {
		border-top: 1px solid ${tokens.colors.outlineVariant};
	}
`;

const FolderText = styled.div`
	display: flex;
	flex-direction: column;
	min-width: 0;
	flex: 1;

	strong {
		font-size: ${tokens.typography.fontSize.sm};
		font-weight: ${tokens.typography.fontWeight.semibold};
		color: ${tokens.colors.onSurface};
	}

	span {
		font-size: ${tokens.typography.fontSize.xs};
		color: ${tokens.colors.onSurfaceVariant};
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
`;

const AskChatBtn = styled.button`
	display: inline-flex;
	align-items: center;
	gap: 0.3rem;
	height: 28px;
	padding: 0 0.625rem;
	border-radius: ${tokens.borderRadius.md};
	border: 1px solid ${alpha(tokens.colors.primary, "55")};
	background: ${alpha(tokens.colors.primary, "14")};
	color: ${tokens.colors.primary};
	font-size: ${tokens.typography.fontSize.xs};
	font-weight: ${tokens.typography.fontWeight.semibold};
	cursor: pointer;
	flex-shrink: 0;
	transition: background ${tokens.transitions.fast};

	&:hover {
		background: ${alpha(tokens.colors.primary, "24")};
	}
`;

const Switch = styled.button<{ $on: boolean }>`
	position: relative;
	width: 36px;
	height: 20px;
	border: none;
	border-radius: 10px;
	background: ${({ $on }) =>
		$on ? tokens.colors.primary : tokens.colors.surfaceContainerHighest};
	cursor: pointer;
	flex-shrink: 0;
	transition: background ${tokens.transitions.fast};

	&::after {
		content: "";
		position: absolute;
		top: 2px;
		left: ${({ $on }) => ($on ? "18px" : "2px")};
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: #ffffff;
		transition: left ${tokens.transitions.fast};
	}
`;

const IconBtn = styled.button`
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 30px;
	height: 30px;
	flex-shrink: 0;

	@media (pointer: coarse) {
		width: 40px;
		height: 40px;
	}
	border: none;
	border-radius: ${tokens.borderRadius.lg};
	background: transparent;
	color: ${tokens.colors.onSurfaceVariant};
	cursor: pointer;

	&:hover {
		background: ${tokens.colors.surfaceContainerHighest};
		color: ${tokens.colors.onSurface};
	}
`;

const DesktopTag = styled.span`
	height: 24px;
	padding: 0 0.5rem;
	display: inline-flex;
	align-items: center;
	border-radius: ${tokens.borderRadius.circle};
	border: 1px solid ${tokens.colors.outlineVariant};
	color: ${tokens.colors.onSurfaceVariant};
	font-size: ${tokens.typography.fontSize.xs};
	flex-shrink: 0;
`;

const Form = styled.form`
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
	padding-top: 0.5rem;
	border-top: 1px solid ${tokens.colors.outlineVariant};
`;

const Field = styled.input`
	height: 36px;

	/* 16px keeps mobile browsers from zooming into the field. */
	@media (pointer: coarse) {
		height: 42px;
		font-size: 16px;
	}

	padding: 0 0.75rem;
	border: 1px solid ${tokens.colors.outlineVariant};
	border-radius: ${tokens.borderRadius.lg};
	background: ${tokens.colors.surfaceContainerLowest};
	color: ${tokens.colors.onSurface};
	font-size: ${tokens.typography.fontSize.sm};
	font-family: inherit;
	outline: none;

	&:focus {
		border-color: ${tokens.colors.primary};
	}
	&::placeholder {
		color: ${tokens.colors.outline};
	}
`;

const FormRow = styled.div`
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 0.5rem;
`;

const LinkBtn = styled.button`
	padding: 0;
	border: none;
	background: transparent;
	color: ${tokens.colors.primary};
	font-size: ${tokens.typography.fontSize.xs};
	cursor: pointer;
	text-align: left;

	&:hover {
		text-decoration: underline;
	}
`;

const PrimaryBtn = styled(ConnectBtn)`
	background: ${tokens.colors.primary};
	border-color: ${tokens.colors.primary};
	color: ${tokens.colors.onPrimaryFixed};

	&:hover:not(:disabled) {
		background: ${tokens.colors.primaryDim};
	}
	&:disabled {
		opacity: 0.6;
		cursor: default;
	}
`;

const EmptyConnectorsBox = styled.div`
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	text-align: center;
	margin-top: 1.5rem;
	padding: 2rem 1.25rem;
	border-radius: ${tokens.borderRadius.xl};
	background: ${tokens.colors.surfaceContainerLow};
	border: 1px solid ${tokens.colors.outlineVariant};
	gap: 0.5rem;
`;

const EmptyConnectorsTitle = styled.p`
	font-family: ${tokens.typography.fontFamily.headline};
	font-size: ${tokens.typography.fontSize.md};
	font-weight: ${tokens.typography.fontWeight.semibold};
	color: ${tokens.colors.onSurface};
	margin-top: 0.25rem;
`;

const EmptyConnectorsSub = styled.p`
	font-size: ${tokens.typography.fontSize.sm};
	color: ${tokens.colors.onSurfaceVariant};
	max-width: 24rem;
	line-height: 1.5;
	margin: 0;
`;

const HiddenInput = styled.input`
	display: none;
`;

export function ConnectorsPage() {
	const navigate = useNavigate();
	const { settings } = useAppContext();
	const { showToast } = useToast();
	const { folders, docs, gmail, repos } = useConnectors();
	const [openForm, setOpenForm] = useState<"gmail" | "github" | null>(null);
	const [email, setEmail] = useState("");
	const [appPassword, setAppPassword] = useState("");
	const [repoInput, setRepoInput] = useState("");
	const [working, setWorking] = useState(false);
	const [picking, setPicking] = useState(false);
	const fileInput = useRef<HTMLInputElement>(null);
	const phone = isMobile();
	const airGapped = Boolean(settings?.air_gap);

	const submitGmail = async (e: React.FormEvent) => {
		e.preventDefault();
		setWorking(true);
		try {
			const mails = await connectGmail(email, appPassword);
			setAppPassword("");
			setOpenForm(null);
			showToast(
				`Gmail connected: read your ${mails.length} newest emails`,
				"success",
			);
		} catch (err) {
			showToast(err instanceof Error ? err.message : String(err), "error");
		} finally {
			setWorking(false);
		}
	};

	const submitRepo = async (e: React.FormEvent) => {
		e.preventDefault();
		setWorking(true);
		try {
			const snap = await connectRepo(repoInput);
			setRepoInput("");
			setOpenForm(null);
			showToast(
				`Connected ${snap.repo}: ${snap.open_items.length} open issues and pull requests`,
				"success",
			);
		} catch (err) {
			showToast(err instanceof Error ? err.message : String(err), "error");
		} finally {
			setWorking(false);
		}
	};

	const connectFolder = async () => {
		setPicking(true);
		try {
			const path = await pickFolder();
			if (!path) return;
			const snapshot = await readFolder(path);
			if (snapshot.total_files === 0) {
				showToast(
					isMac()
						? `Neurix couldn't see any files in ${snapshot.name}. If macOS asked for access, allow it, or check System Settings › Privacy & Security › Files and Folders.`
						: `Neurix couldn't see any files in ${snapshot.name}.`,
					"error",
				);
				return;
			}
			addFolder(snapshot);
			const skipped = snapshot.unreadable.length;
			showToast(
				`Connected ${snapshot.name}: ${snapshot.text_files.length} readable files${
					skipped > 0
						? `, ${skipped} skipped (images, scans and other formats)`
						: ""
				}${snapshot.partial ? ". The folder is very large, so only part of it can be searched" : ""}`,
				"success",
			);
		} catch (err) {
			showToast(err instanceof Error ? err.message : String(err), "error");
		} finally {
			setPicking(false);
		}
	};

	const onFilesPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = Array.from(e.target.files ?? []);
		e.target.value = "";
		if (files.length === 0) return;
		setPicking(true);
		try {
			const { added, skipped } = await addDocuments(files);
			if (added.length > 0) {
				const names =
					added.length === 1 ? added[0].name : `${added.length} documents`;
				const note =
					skipped.length === 0
						? ""
						: skipped.length === 1
							? `. Skipped ${skipped[0]}, which isn't text`
							: `. Skipped ${skipped.length} files that aren't text`;
				showToast(`Added ${names}${note}`, "success");
			} else {
				showToast(
					"Those files aren't text. Pick .txt, .md, .csv or .json files.",
					"error",
				);
			}
		} finally {
			setPicking(false);
		}
	};

	const askWithFolder = (path: string, enabled: boolean) => {
		if (!enabled) setFolderEnabled(path, true);
		navigate("/chat", { state: { freshChat: true } });
	};

	const askWithRepo = (repo: string, enabled: boolean) => {
		if (!enabled) setRepoEnabled(repo, true);
		navigate("/chat", { state: { freshChat: true } });
	};

	const askWithDoc = (id: string, enabled: boolean) => {
		if (!enabled) setDocEnabled(id, true);
		navigate("/chat", { state: { freshChat: true } });
	};

	const countBadge = (n: number) =>
		n > 0 && (
			<Badge>
				<Icon name="check" size={12} />
				{n}
			</Badge>
		);

	const actions = (c: Connector) => {
		if (c.id === "files" && phone) return <DesktopTag>Desktop app</DesktopTag>;
		switch (c.id) {
			case "files":
				return (
					<>
						{countBadge(folders.length)}
						<ConnectBtn
							type="button"
							onClick={connectFolder}
							disabled={picking}
						>
							{folders.length > 0 ? "Add" : "Connect"}
						</ConnectBtn>
					</>
				);
			case "gmail":
				return (
					<>
						{gmail?.signedIn && (
							<Badge>
								<Icon name="check" size={12} />
								On
							</Badge>
						)}
						<ConnectBtn
							type="button"
							onClick={() =>
								setOpenForm(openForm === "gmail" ? null : "gmail")
							}
						>
							{gmail?.signedIn
								? "Change"
								: gmail
									? "Sign in again"
									: "Connect"}
						</ConnectBtn>
					</>
				);
			case "github":
				return (
					<>
						{countBadge(repos.length)}
						<ConnectBtn
							type="button"
							onClick={() =>
								setOpenForm(openForm === "github" ? null : "github")
							}
						>
							{repos.length > 0 ? "Add" : "Connect"}
						</ConnectBtn>
					</>
				);
		}
	};

	const card = (c: Connector) => {
		const isExpanded =
			(c.id === "gmail" && openForm === "gmail") ||
			(c.id === "github" && openForm === "github");
		return (
			<Card key={c.id} $expanded={isExpanded}>
				<CardTop>
					<Tile $tint={c.tint}>
						<Icon name={c.icon} size={18} />
					</Tile>
					<Name>
						<strong>{c.name}</strong>
						<span>{c.access}</span>
					</Name>
					{actions(c)}
				</CardTop>
				<Description>{c.description}</Description>
				{c.id === "gmail" && openForm === "gmail" && (
					<Form onSubmit={submitGmail}>
						<Field
							type="email"
							inputMode="email"
							placeholder="you@gmail.com"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							required
							autoComplete="off"
							autoCapitalize="none"
						/>
						<Field
							type="password"
							placeholder="App password (16 letters)"
							value={appPassword}
							onChange={(e) => setAppPassword(e.target.value)}
							required
							autoComplete="off"
							autoCapitalize="none"
						/>
						<LinkBtn
							type="button"
							onClick={() =>
								openUrl("https://myaccount.google.com/apppasswords").catch(
									() => {},
								)
							}
						>
							Create an app password in your Google account (needs 2-Step
							Verification)
						</LinkBtn>
						<FormRow>
							<PrimaryBtn type="submit" disabled={working || airGapped}>
								{working ? "Checking…" : "Connect Gmail"}
							</PrimaryBtn>
							<Description>
								{airGapped
									? "Paused while Air-Gap Mode is enabled."
									: phone
										? "Read only. The password stays in memory until the app closes."
										: "Read only. The password stays in memory until you quit."}
							</Description>
						</FormRow>
					</Form>
				)}
				{c.id === "github" && openForm === "github" && (
					<Form onSubmit={submitRepo}>
						<Field
							placeholder="owner/repository, e.g. Razee4315/neurix"
							value={repoInput}
							onChange={(e) => setRepoInput(e.target.value)}
							required
							autoComplete="off"
							autoCapitalize="none"
							autoCorrect="off"
							spellCheck={false}
						/>
						<FormRow>
							<PrimaryBtn type="submit" disabled={working || airGapped}>
								{working ? "Reading…" : "Connect repository"}
							</PrimaryBtn>
							<Description>
								{airGapped
									? "Paused while Air-Gap Mode is enabled."
									: "Public repositories."}
							</Description>
						</FormRow>
					</Form>
				)}
			</Card>
		);
	};

	const hasAnyConnected =
		folders.length > 0 || docs.length > 0 || Boolean(gmail) || repos.length > 0;

	return (
		<AppLayout title="Connectors">
			<Page>
				<HiddenInput
					ref={fileInput}
					type="file"
					multiple
					onChange={onFilesPicked}
				/>
				<Intro>
					Connectors let the assistant read from your local files and trusted
					repositories. Everything is indexed and processed on this device, and
					the assistant only reads — it never modifies, sends, or deletes
					anything.
				</Intro>

				{airGapped && (
					<AirGapBanner role="status">
						<AirGapText>
							<Icon
								name="enhanced_encryption"
								size={16}
								color={tokens.colors.secondary}
							/>
							<span>
								<strong>Air-Gap Mode Active:</strong> Online connectors (Gmail
								and GitHub) are locked at the local network boundary.{" "}
								<strong>Local folders · SQLite FTS5</strong> and{" "}
								<strong>Documents</strong> remain 100% functional offline.
							</span>
						</AirGapText>
						<AirGapBtn type="button" onClick={() => navigate("/settings")}>
							Air-Gap Settings
						</AirGapBtn>
					</AirGapBanner>
				)}

				<Heading>Available</Heading>
				<Grid>{CONNECTORS.map(card)}</Grid>

				<DocsStrip>
					<DocsStripLeft>
						<Tile $tint="#207368">
							<Icon name="description" size={18} />
						</Tile>
						<Name>
							<strong>Documents · Quick local files</strong>
							<span>
								Pick .txt, .md, .csv, or .json files directly from this device
							</span>
						</Name>
					</DocsStripLeft>
					<DocsStripActions>
						{countBadge(docs.length)}
						<ConnectBtn
							type="button"
							onClick={() => fileInput.current?.click()}
							disabled={picking}
						>
							{docs.length > 0 ? "Add files" : "Pick files"}
						</ConnectBtn>
					</DocsStripActions>
				</DocsStrip>

				{!hasAnyConnected ? (
					<EmptyConnectorsBox>
						<EmptyArt kind="connectors" />
						<EmptyConnectorsTitle>
							No sources connected yet
						</EmptyConnectorsTitle>
						<EmptyConnectorsSub>
							Connect a local folder, pick documents, or link a repository above
							to ground your chats in your own files with clickable citations.
						</EmptyConnectorsSub>
					</EmptyConnectorsBox>
				) : (
					<>
						{!phone && folders.length > 0 && (
							<>
								<Heading>Connected folders (SQLite FTS5)</Heading>
								<FolderList>
									{folders.map((f) => (
										<FolderRow key={f.path}>
											<Icon
												name="folder_open"
												size={18}
												color={tokens.colors.primary}
											/>
											<FolderText>
												<strong>{f.name}</strong>
												<span title={f.path}>
													{f.textFiles} readable of {f.files} files · {f.path}
												</span>
											</FolderText>
											<AskChatBtn
												type="button"
												onClick={() => askWithFolder(f.path, f.enabled)}
											>
												<Icon name="chat" size={12} />
												Ask in chat
											</AskChatBtn>
											<Switch
												type="button"
												role="switch"
												$on={f.enabled}
												aria-checked={f.enabled}
												aria-label={`Use ${f.name} in chats`}
												title={
													f.enabled ? "Used in chats" : "Not used in chats"
												}
												onClick={() => setFolderEnabled(f.path, !f.enabled)}
											/>
											<IconBtn
												type="button"
												aria-label={`Disconnect ${f.name}`}
												title="Disconnect"
												onClick={() => removeFolder(f.path)}
											>
												<Icon name="close" size={16} />
											</IconBtn>
										</FolderRow>
									))}
								</FolderList>
							</>
						)}

						{docs.length > 0 && (
							<>
								<Heading>Documents</Heading>
								<FolderList>
									{docs.map((d) => (
										<FolderRow key={d.id}>
											<Icon
												name="description"
												size={18}
												color={tokens.colors.primary}
											/>
											<FolderText>
												<strong>{d.name}</strong>
												<span>
													{d.text.length.toLocaleString()} characters
													{d.truncated ? ", the start of a longer file" : ""}
												</span>
											</FolderText>
											<AskChatBtn
												type="button"
												onClick={() => askWithDoc(d.id, d.enabled)}
											>
												<Icon name="chat" size={12} />
												Ask in chat
											</AskChatBtn>
											<Switch
												type="button"
												role="switch"
												$on={d.enabled}
												aria-checked={d.enabled}
												aria-label={`Use ${d.name} in chats`}
												onClick={() => setDocEnabled(d.id, !d.enabled)}
											/>
											<IconBtn
												type="button"
												title="Remove"
												aria-label={`Remove ${d.name}`}
												onClick={() => removeDoc(d.id)}
											>
												<Icon name="close" size={16} />
											</IconBtn>
										</FolderRow>
									))}
								</FolderList>
							</>
						)}

						{(gmail || repos.length > 0) && (
							<>
								<Heading>Connected accounts & repositories</Heading>
								<FolderList>
									{gmail && (
										<FolderRow>
											<Icon
												name="mail"
												size={18}
												color={tokens.colors.primary}
											/>
											<FolderText>
												<strong>Gmail · {gmail.email}</strong>
												<span>
													{gmail.signedIn
														? "Newest emails, read only"
														: "Sign in again to use it (password is not stored)"}
												</span>
											</FolderText>
											<Switch
												type="button"
												role="switch"
												$on={gmail.enabled}
												aria-checked={gmail.enabled}
												aria-label="Use Gmail in chats"
												onClick={() => setGmailEnabled(!gmail.enabled)}
											/>
											<IconBtn
												type="button"
												title="Disconnect"
												aria-label="Disconnect Gmail"
												onClick={disconnectGmail}
											>
												<Icon name="close" size={16} />
											</IconBtn>
										</FolderRow>
									)}
									{repos.map((r) => (
										<FolderRow key={r.repo}>
											<Icon
												name="github"
												size={18}
												color={tokens.colors.primary}
											/>
											<FolderText>
												<strong>{r.repo}</strong>
												<span>{r.description || "Public repository"}</span>
											</FolderText>
											<AskChatBtn
												type="button"
												onClick={() => askWithRepo(r.repo, r.enabled)}
											>
												<Icon name="chat" size={12} />
												Ask in chat
											</AskChatBtn>
											<Switch
												type="button"
												role="switch"
												$on={r.enabled}
												aria-checked={r.enabled}
												aria-label={`Use ${r.repo} in chats`}
												onClick={() => setRepoEnabled(r.repo, !r.enabled)}
											/>
											<IconBtn
												type="button"
												title="Disconnect"
												aria-label={`Disconnect ${r.repo}`}
												onClick={() => removeRepo(r.repo)}
											>
												<Icon name="close" size={16} />
											</IconBtn>
										</FolderRow>
									))}
								</FolderList>
							</>
						)}
					</>
				)}
			</Page>
		</AppLayout>
	);
}
