import { AppLayout } from "@/components/layout/AppLayout";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { alpha } from "@/theme/alpha";
import { tokens } from "@/theme/tokens";
import { pickFolder, readFolder } from "@/services/connectorService";
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
import { openUrl } from "@tauri-apps/plugin-opener";
import { isMobile } from "@/utils/platform";
import { useRef, useState } from "react";
import styled from "styled-components";

/**
 * Connectors: the tools the assistant can read from. Local folders,
 * documents, Gmail and GitHub work now; the rest are listed as coming soon
 * instead of pretending to connect.
 *
 * Phones and computers differ in what they can reach. A phone can't hand an
 * app a folder to read later, so phones get Documents (files picked one by
 * one and copied in) and the desktop gets Local folders.
 */

/** Connectors that work in this build; the rest are listed as coming soon. */
const LIVE = new Set(["files", "docs", "gmail", "github"]);
/** Reading whole folders from disk needs the desktop app. */
const DESKTOP_ONLY = new Set(["files"]);
/** Picking single files is how phones share documents. */
const PHONE_ONLY = new Set(["docs"]);

interface Connector {
	id: string;
	name: string;
	icon: string;
	/** Brand color of the tile behind the icon. */
	tint: string;
	description: string;
	access: string;
}

const CONNECTORS: Connector[] = [
	{
		id: "files",
		name: "Local folders",
		icon: "folder_open",
		tint: "#b0603f",
		description: "Point the assistant at folders on this computer.",
		access: "On this device",
	},
	{
		id: "docs",
		name: "Documents",
		icon: "description",
		tint: "#b0603f",
		description:
			"Pick text, Markdown, CSV or JSON files on this phone for the assistant to read.",
		access: "On this device",
	},
	{
		id: "gmail",
		name: "Gmail",
		icon: "mail",
		tint: "#ea4335",
		description:
			"Search and summarise your email, draft replies for you to send.",
		access: "Read only",
	},
	{
		id: "drive",
		name: "Google Drive",
		icon: "folder_open",
		tint: "#1fa463",
		description: "Ask questions about your documents, sheets and PDFs.",
		access: "Read only",
	},
	{
		id: "outlook",
		name: "Outlook",
		icon: "calendar",
		tint: "#0f78d4",
		description: "Email and calendar from Microsoft 365.",
		access: "Read only",
	},
	{
		id: "slack",
		name: "Slack",
		icon: "tag",
		tint: "#611f69",
		description: "Catch up on channels and threads you follow.",
		access: "Read only",
	},
	{
		id: "notion",
		name: "Notion",
		icon: "notes",
		tint: "#5f5e5a",
		description: "Pages and databases from your workspace.",
		access: "Read only",
	},
	{
		id: "github",
		name: "GitHub",
		icon: "github",
		tint: "#3a3a3a",
		description: "Repositories, issues and pull requests.",
		access: "Public repositories",
	},
];

const Page = styled.div`
  max-width: 48rem;
  margin: 0 auto;
  padding: 1.5rem 1.25rem 3rem;
`;

const Intro = styled.p`
  margin: 0 0 1.25rem;
  font-size: ${tokens.typography.fontSize.base};
  line-height: 1.6;
  color: ${tokens.colors.onSurfaceVariant};
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.625rem;

  @media (min-width: 640px) { grid-template-columns: 1fr 1fr; }
`;

const Card = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  background: ${tokens.colors.surfaceContainer};
  border: 1px solid ${alpha(tokens.colors.outlineVariant, "99")};
  border-radius: ${tokens.borderRadius.xl};
  transition: border-color ${tokens.transitions.fast};

  &:hover { border-color: ${tokens.colors.outlineVariant}; }
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
    font-size: ${tokens.typography.fontSize.xs};
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
  height: 30px;

  @media (pointer: coarse) { height: 36px; padding: 0 0.875rem; }

  padding: 0 0.75rem;
  border: 1px solid ${alpha(tokens.colors.outlineVariant, "cc")};
  border-radius: ${tokens.borderRadius.lg};
  background: ${tokens.colors.surfaceContainerHigh};
  color: ${tokens.colors.onSurface};
  font-size: ${tokens.typography.fontSize.sm};
  font-weight: ${tokens.typography.fontWeight.medium};
  cursor: pointer;
  flex-shrink: 0;
  transition: background ${tokens.transitions.fast};

  &:hover { background: ${tokens.colors.surfaceContainerHighest}; }
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
  font-size: ${tokens.typography.fontSize.xs};
  font-weight: ${tokens.typography.fontWeight.medium};
  flex-shrink: 0;
`;

const Heading = styled.h2`
  margin: 1.5rem 0 0.625rem;
  font-size: ${tokens.typography.fontSize.sm};
  font-weight: ${tokens.typography.fontWeight.medium};
  color: ${tokens.colors.onSurfaceVariant};
`;

const FolderList = styled.div`
  display: flex;
  flex-direction: column;
  border: 1px solid ${alpha(tokens.colors.outlineVariant, "99")};
  border-radius: ${tokens.borderRadius.xl};
  overflow: hidden;
`;

const FolderRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: ${tokens.colors.surfaceContainer};

  & + & { border-top: 1px solid ${alpha(tokens.colors.outlineVariant, "80")}; }
`;

const FolderText = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;

  strong {
    font-size: ${tokens.typography.fontSize.sm};
    font-weight: ${tokens.typography.fontWeight.medium};
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

const Switch = styled.button<{ $on: boolean }>`
  position: relative;
  width: 36px;
  height: 20px;
  border: none;
  border-radius: 10px;
  background: ${({ $on }) => ($on ? tokens.colors.primary : tokens.colors.surfaceContainerHighest)};
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

  @media (pointer: coarse) { width: 40px; height: 40px; }
  border: none;
  border-radius: ${tokens.borderRadius.lg};
  background: transparent;
  color: ${tokens.colors.onSurfaceVariant};
  cursor: pointer;

  &:hover { background: ${tokens.colors.surfaceContainerHighest}; color: ${tokens.colors.onSurface}; }
`;

const SoonTag = styled.span`
  height: 24px;
  padding: 0 0.5rem;
  display: inline-flex;
  align-items: center;
  border-radius: ${tokens.borderRadius.circle};
  border: 1px solid ${alpha(tokens.colors.outlineVariant, "cc")};
  color: ${tokens.colors.onSurfaceVariant};
  font-size: ${tokens.typography.fontSize.xs};
  flex-shrink: 0;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const Field = styled.input`
  height: 34px;

  /* 16px keeps mobile browsers from zooming into the field. */
  @media (pointer: coarse) { height: 42px; font-size: 16px; }

  padding: 0 0.75rem;
  border: 1px solid ${alpha(tokens.colors.outlineVariant, "cc")};
  border-radius: ${tokens.borderRadius.lg};
  background: ${tokens.colors.surfaceContainerLowest};
  color: ${tokens.colors.onSurface};
  font-size: ${tokens.typography.fontSize.sm};
  font-family: inherit;
  outline: none;

  &:focus { border-color: ${tokens.colors.outline}; }
  &::placeholder { color: ${tokens.colors.outline}; }
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

  &:hover { text-decoration: underline; }
`;

const PrimaryBtn = styled(ConnectBtn)`
  background: ${tokens.colors.primary};
  border-color: ${tokens.colors.primary};
  color: ${tokens.colors.onPrimary};

  &:hover { background: ${tokens.colors.primaryDim}; }
  &:disabled { opacity: 0.6; cursor: default; }
`;

const Custom = styled.button`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  margin-top: 0.625rem;
  padding: 0.875rem 1rem;
  border: 1px dashed ${tokens.colors.outlineVariant};
  border-radius: ${tokens.borderRadius.xl};
  background: transparent;
  color: ${tokens.colors.onSurfaceVariant};
  font-size: ${tokens.typography.fontSize.sm};
  text-align: left;
  cursor: pointer;

  &:hover { color: ${tokens.colors.onSurface}; border-color: ${tokens.colors.outline}; }

  strong { color: ${tokens.colors.onSurface}; font-weight: ${tokens.typography.fontWeight.medium}; }
`;

const HiddenInput = styled.input`
  display: none;
`;

const DesktopNote = styled.p`
  margin: 0.625rem 0 0;
  font-size: ${tokens.typography.fontSize.xs};
  line-height: 1.5;
  color: ${tokens.colors.onSurfaceVariant};
`;

export function ConnectorsPage() {
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
	const comingSoon = (name: string) =>
		showToast(`${name} connects in the next release`, "info");

	const runsHere = (id: string) =>
		phone ? !DESKTOP_ONLY.has(id) : !PHONE_ONLY.has(id);
	const available = CONNECTORS.filter((c) => LIVE.has(c.id) && runsHere(c.id));
	const desktopOnly = phone
		? CONNECTORS.filter((c) => DESKTOP_ONLY.has(c.id))
		: [];
	const soon = CONNECTORS.filter((c) => !LIVE.has(c.id));

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
			const snapshot = await readFolder(path, 0);
			if (snapshot.total_files === 0) {
				showToast(
					`Neurix couldn't see any files in ${snapshot.name}. If macOS asked for access, allow it, or check System Settings › Privacy & Security › Files and Folders.`,
					"error",
				);
				return;
			}
			addFolder(snapshot);
			showToast(
				`Connected ${snapshot.name}: ${snapshot.text_files} readable files`,
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

	const actions = (c: Connector) => {
		if (!runsHere(c.id)) return <SoonTag>Desktop app</SoonTag>;
		if (!LIVE.has(c.id)) return <SoonTag>Soon</SoonTag>;
		const count = (n: number) =>
			n > 0 && (
				<Badge>
					<Icon name="check" size={12} />
					{n}
				</Badge>
			);
		switch (c.id) {
			case "files":
				return (
					<>
						{count(folders.length)}
						<ConnectBtn
							type="button"
							onClick={connectFolder}
							disabled={picking}
						>
							{folders.length > 0 ? "Add" : "Connect"}
						</ConnectBtn>
					</>
				);
			case "docs":
				return (
					<>
						{count(docs.length)}
						<ConnectBtn
							type="button"
							onClick={() => fileInput.current?.click()}
							disabled={picking}
						>
							{docs.length > 0 ? "Add" : "Pick files"}
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
							onClick={() => setOpenForm(openForm === "gmail" ? null : "gmail")}
						>
							{gmail?.signedIn ? "Change" : gmail ? "Sign in again" : "Connect"}
						</ConnectBtn>
					</>
				);
			case "github":
				return (
					<>
						{count(repos.length)}
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
			default:
				return <SoonTag>Soon</SoonTag>;
		}
	};

	const card = (c: Connector) => (
		<Card key={c.id}>
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
						<PrimaryBtn type="submit" disabled={working}>
							{working ? "Checking…" : "Connect Gmail"}
						</PrimaryBtn>
						<Description>
							{phone
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
						<PrimaryBtn type="submit" disabled={working}>
							{working ? "Reading…" : "Connect repository"}
						</PrimaryBtn>
						<Description>Public repositories.</Description>
					</FormRow>
				</Form>
			)}
		</Card>
	);

	const connected = (
		<>
			{(gmail || repos.length > 0) && (
				<>
					<Heading>Connected accounts</Heading>
					<FolderList>
						{gmail && (
							<FolderRow>
								<Icon name="mail" size={18} color={tokens.colors.primary} />
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
								<Icon name="github" size={18} color={tokens.colors.primary} />
								<FolderText>
									<strong>{r.repo}</strong>
									<span>{r.description || "Public repository"}</span>
								</FolderText>
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
			{!phone && folders.length > 0 && (
				<>
					<Heading>Connected folders</Heading>
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
								<Switch
									type="button"
									role="switch"
									$on={f.enabled}
									aria-checked={f.enabled}
									aria-label={`Use ${f.name} in chats`}
									title={f.enabled ? "Used in chats" : "Not used in chats"}
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
		</>
	);

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
					Connectors let the assistant read from the tools you already use. Data
					is fetched and processed on this device, and the assistant only reads.
					It never sends, posts or deletes without asking you first.
				</Intro>
				<Heading>Available</Heading>
				<Grid>{available.map(card)}</Grid>
				{phone && connected}
				<Heading>Coming soon</Heading>
				<Grid>{soon.map(card)}</Grid>
				{!phone && connected}
				{phone ? (
					<>
						<Heading>In the desktop app</Heading>
						<Grid>{desktopOnly.map(card)}</Grid>
						<DesktopNote>
							The desktop app can also read whole folders and, in a later
							release, connect to MCP servers on your computer or network.
						</DesktopNote>
					</>
				) : (
					<Custom
						type="button"
						onClick={() => comingSoon("Custom MCP servers")}
					>
						<Icon name="add" size={18} />
						<span>
							<strong>Add a custom connector</strong>
							<br />
							Any MCP server running on this computer or your network
						</span>
					</Custom>
				)}
			</Page>
		</AppLayout>
	);
}
