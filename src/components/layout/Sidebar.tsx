import { OPEN_PALETTE } from "@/components/CommandPalette";
import { Icon } from "@/components/ui/Icon";
import { NeurixMark } from "@/components/ui/NeurixLogo";
import { useToast } from "@/components/ui/Toast";
import { useAppContext } from "@/context/AppContext";
import { useDownloads } from "@/context/DownloadContext";
import { historyService } from "@/services";
import { CHAT_STARTED, HISTORY_CHANGED } from "@/services/historyService";
import type { ConversationMeta } from "@/services/types";
import { alpha } from "@/theme/alpha";
import { tokens } from "@/theme/tokens";
import { togglePin, usePins } from "@/utils/pins";
import { isMac } from "@/utils/platform";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import styled from "styled-components";

/**
 * The desktop sidebar: brand, new chat, the main sections, recent chats and
 * a status line at the foot. Wide windows only; phones keep `BottomNav`.
 */

const SECTIONS = [
	{ icon: "chat_bubble", label: "Chats", path: "/chat", owns: ["/character", "/friend"] },
	{ icon: "deployed_code", label: "Models", path: "/models", owns: [] },
	{ icon: "storefront", label: "Model Store", path: "/store", owns: ["/downloading"] },
	{ icon: "plug", label: "Connectors", path: "/connectors", owns: [] },
] as const;

const RECENT_LIMIT = 30;

const Aside = styled.aside`
  grid-area: nav;
  display: none;

  @media (min-width: ${tokens.breakpoints.wide}) {
    display: flex;
    flex-direction: column;
    width: 264px;
    min-height: 0;
    background: ${tokens.colors.surfaceContainerLow};
    padding: 0.625rem 0.5rem 0.5rem;
  }
`;

const Brand = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  height: 40px;
  padding: 0 0.625rem;
  margin-bottom: 0.5rem;
  color: ${tokens.colors.primary};
`;

const Wordmark = styled.span`
  font-family: ${tokens.typography.fontFamily.headline};
  font-size: 1.0625rem;
  font-weight: ${tokens.typography.fontWeight.semibold};
  letter-spacing: -0.015em;
  color: ${tokens.colors.onSurface};
`;

const Row = styled.button<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.625rem;
  width: 100%;
  height: 34px;
  padding: 0 0.625rem;
  border: none;
  border-radius: ${tokens.borderRadius.lg};
  background: ${({ $active }) => ($active ? tokens.colors.surfaceContainerHighest : "transparent")};
  color: ${({ $active }) => ($active ? tokens.colors.onSurface : alpha(tokens.colors.onSurface, "d9"))};
  font-family: ${tokens.typography.fontFamily.label};
  font-size: ${tokens.typography.fontSize.base};
  font-weight: ${tokens.typography.fontWeight.regular};
  text-align: left;
  cursor: pointer;
  transition: background ${tokens.transitions.fast}, color ${tokens.transitions.fast};

  &:hover {
    background: ${({ $active }) =>
			$active ? tokens.colors.surfaceContainerHighest : tokens.colors.surfaceContainerHigh};
    color: ${tokens.colors.onSurface};
  }

  &:active { transform: scale(0.985); }

  > span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const Progress = styled.small`
  margin-left: auto;
  flex-shrink: 0;
  font-size: ${tokens.typography.fontSize.xs};
  font-variant-numeric: tabular-nums;
  color: ${tokens.colors.primary};
`;

const NewChatIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  margin-left: -2px;
  border-radius: 50%;
  background: ${tokens.colors.primary};
  color: ${tokens.colors.onPrimary};
`;

const Group = styled.nav`
  display: flex;
  flex-direction: column;
  gap: 1px;
`;

const SectionLabel = styled.div`
  flex-shrink: 0;
  padding: 1.125rem 0.625rem 0.375rem;
  font-size: ${tokens.typography.fontSize.xs};
  font-weight: ${tokens.typography.fontWeight.medium};
  color: ${tokens.colors.onSurfaceVariant};
`;

const Recents = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin: 0 -0.25rem;
  padding: 0 0.25rem;

  &::-webkit-scrollbar { width: 0; }
  scrollbar-width: none;
`;

const RecentRow = styled(Row)`
  height: 32px;
  font-size: ${tokens.typography.fontSize.sm};
  color: ${({ $active }) => ($active ? tokens.colors.onSurface : alpha(tokens.colors.onSurface, "bf"))};
`;

const MoreBtn = styled.button`
  position: absolute;
  top: 4px;
  right: 4px;
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: ${tokens.borderRadius.md};
  background: ${tokens.colors.surfaceContainerHighest};
  color: ${tokens.colors.onSurfaceVariant};
  cursor: pointer;
  opacity: 0;
  transition: opacity ${tokens.transitions.fast};

  &:hover { color: ${tokens.colors.onSurface}; }
  &:focus-visible { opacity: 1; }
`;

const RecentWrap = styled.div`
  position: relative;
  /* Keep full height when the list outgrows the sidebar, so it scrolls. */
  flex-shrink: 0;

  &:hover ${MoreBtn}, &:focus-within ${MoreBtn}, &[data-menu] ${MoreBtn} { opacity: 1; }
`;

const RenameField = styled.input`
  width: 100%;
  height: 32px;
  padding: 0 0.625rem;
  border: 1px solid ${tokens.colors.outline};
  border-radius: ${tokens.borderRadius.lg};
  background: ${tokens.colors.surfaceContainerHighest};
  color: ${tokens.colors.onSurface};
  font-family: inherit;
  font-size: ${tokens.typography.fontSize.sm};
  outline: none;
`;

const RowMenu = styled.div<{ $x: number; $y: number }>`
  position: fixed;
  left: ${({ $x }) => $x}px;
  top: ${({ $y }) => $y}px;
  width: 11rem;
  padding: 0.25rem;
  background: ${tokens.colors.surfaceContainer};
  border: 1px solid ${alpha(tokens.colors.outlineVariant, "cc")};
  border-radius: ${tokens.borderRadius.xl};
  z-index: ${tokens.zIndex.overlay};
`;

const Empty = styled.div`
  padding: 0.25rem 0.625rem;
  font-size: ${tokens.typography.fontSize.sm};
  color: ${tokens.colors.onSurfaceVariant};
`;

const FootWrap = styled.div`
  position: relative;
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid ${alpha(tokens.colors.outlineVariant, "80")};
`;

const Foot = styled.button<{ $open: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.625rem;
  width: 100%;
  padding: 0.5rem 0.625rem;
  border: none;
  border-radius: ${tokens.borderRadius.lg};
  background: ${({ $open }) => ($open ? tokens.colors.surfaceContainerHigh : "transparent")};
  text-align: left;
  cursor: pointer;

  &:hover { background: ${tokens.colors.surfaceContainerHigh}; }
  > svg { margin-left: auto; color: ${tokens.colors.onSurfaceVariant}; }
`;

/* The account menu, opening upwards from the foot like Claude's. */
const Menu = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(100% + 6px);
  padding: 0.375rem;
  background: ${tokens.colors.surfaceContainer};
  border: 1px solid ${alpha(tokens.colors.outlineVariant, "cc")};
  border-radius: ${tokens.borderRadius.xl};
  box-shadow: 0 12px 32px rgb(0 0 0 / 0.35);
  z-index: ${tokens.zIndex.overlay};
`;

const MenuHeader = styled.div`
  padding: 0.375rem 0.625rem 0.5rem;
  font-size: ${tokens.typography.fontSize.xs};
  color: ${tokens.colors.onSurfaceVariant};
`;

const MenuItem = styled.button`
  display: flex;
  align-items: center;
  gap: 0.625rem;
  width: 100%;
  height: 34px;
  padding: 0 0.625rem;
  border: none;
  border-radius: ${tokens.borderRadius.lg};
  background: transparent;
  color: ${tokens.colors.onSurface};
  font-size: ${tokens.typography.fontSize.sm};
  text-align: left;
  cursor: pointer;

  &:hover { background: ${tokens.colors.surfaceContainerHighest}; }
  > kbd {
    margin-left: auto;
    font-family: inherit;
    font-size: ${tokens.typography.fontSize.xs};
    color: ${tokens.colors.onSurfaceVariant};
  }
`;

const MenuDivider = styled.div`
  height: 1px;
  margin: 0.375rem 0.25rem;
  background: ${alpha(tokens.colors.outlineVariant, "99")};
`;

const Avatar = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: ${tokens.colors.surfaceContainerHighest};
  color: ${tokens.colors.onSurface};
  flex-shrink: 0;
`;

const FootText = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.25;

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

interface RecentItemProps {
	entry: ConversationMeta & { pending?: boolean };
	active: boolean;
	pinned: boolean;
	onOpen: () => void;
	/** The open chat was deleted, so leave it. */
	onDeletedOpen: () => void;
}

const MENU_WIDTH = 176;
const MENU_HEIGHT = 118;

function RecentItem({ entry, active, pinned, onOpen, onDeletedOpen }: RecentItemProps) {
	const { showToast } = useToast();
	const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
	const [renaming, setRenaming] = useState(false);
	const [title, setTitle] = useState(entry.title);
	const menuRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!menu) return;
		const onPointer = (e: PointerEvent) => {
			if (!menuRef.current?.contains(e.target as Node)) setMenu(null);
		};
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(null);
		document.addEventListener("pointerdown", onPointer);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("pointerdown", onPointer);
			document.removeEventListener("keydown", onKey);
		};
	}, [menu]);

	const openMenuAt = (x: number, y: number) =>
		setMenu({
			x: Math.min(x, window.innerWidth - MENU_WIDTH - 8),
			y: Math.min(y, window.innerHeight - MENU_HEIGHT - 8),
		});

	const finishRename = async () => {
		setRenaming(false);
		const next = title.trim();
		if (!next || next === entry.title) return setTitle(entry.title);
		try {
			const conversation = await historyService.loadConversation(entry.id);
			if (conversation) await historyService.saveConversation({ ...conversation, title: next });
		} catch {
			showToast("Couldn't rename that chat", "error");
		}
	};

	const remove = async () => {
		setMenu(null);
		try {
			const backup = await historyService.loadConversation(entry.id);
			await historyService.deleteConversation(entry.id);
			if (pinned) togglePin(entry.id);
			if (active) onDeletedOpen();
			showToast(
				`Deleted "${entry.title}"`,
				"info",
				backup
					? {
							label: "Undo",
							onAction: () => {
								historyService
									.saveConversation(backup)
									.then(() => pinned && togglePin(entry.id))
									.catch(() => showToast("Couldn't restore that chat", "error"));
							},
						}
					: undefined,
			);
		} catch {
			showToast("Couldn't delete that chat", "error");
		}
	};

	if (renaming) {
		return (
			<RecentWrap>
				<RenameField
					autoFocus
					value={title}
					maxLength={80}
					aria-label="Chat name"
					onFocus={(e) => e.currentTarget.select()}
					onChange={(e) => setTitle(e.target.value)}
					onBlur={finishRename}
					onKeyDown={(e) => {
						if (e.key === "Enter") e.currentTarget.blur();
						if (e.key === "Escape") {
							setTitle(entry.title);
							setRenaming(false);
						}
					}}
				/>
			</RecentWrap>
		);
	}

	return (
		<RecentWrap data-menu={menu ? "" : undefined}>
			<RecentRow
				type="button"
				title={entry.title}
				$active={active}
				onClick={onOpen}
				onContextMenu={(e) => {
					e.preventDefault();
					openMenuAt(e.clientX, e.clientY);
				}}
			>
				<span>{entry.title || "Untitled chat"}</span>
			</RecentRow>
			{!entry.pending && (
				<MoreBtn
					type="button"
					aria-label={`More actions for ${entry.title}`}
					aria-haspopup="menu"
					onClick={(e) => {
						const box = e.currentTarget.getBoundingClientRect();
						openMenuAt(box.left, box.bottom + 4);
					}}
				>
					<Icon name="more_horiz" size={15} />
				</MoreBtn>
			)}
			{menu &&
				createPortal(
					<RowMenu ref={menuRef} role="menu" $x={menu.x} $y={menu.y}>
						<MenuItem
							type="button"
							role="menuitem"
							onClick={() => {
								setMenu(null);
								togglePin(entry.id);
							}}
						>
							<Icon name={pinned ? "pin_off" : "push_pin"} size={15} />
							{pinned ? "Unpin" : "Pin"}
						</MenuItem>
						<MenuItem
							type="button"
							role="menuitem"
							onClick={() => {
								setMenu(null);
								setTitle(entry.title);
								setRenaming(true);
							}}
						>
							<Icon name="edit" size={15} />
							Rename
						</MenuItem>
						<MenuItem type="button" role="menuitem" onClick={remove}>
							<Icon name="delete" size={15} />
							Delete
						</MenuItem>
					</RowMenu>,
					document.body,
				)}
		</RecentWrap>
	);
}

export function Sidebar() {
	const location = useLocation();
	const navigate = useNavigate();
	const { activeModel } = useAppContext();
	const { downloads } = useDownloads();
	const pins = usePins();
	const running = Object.values(downloads).filter((d) => d.status === "downloading" || d.status === "verifying");
	const total = running.reduce((sum, d) => sum + d.totalBytes, 0);
	const done = running.reduce((sum, d) => sum + d.downloadedBytes, 0);
	const percent = total > 0 ? Math.floor((done / total) * 100) : 0;
	const [recents, setRecents] = useState<(ConversationMeta & { pending?: boolean })[] | null>(null);
	const [menuOpen, setMenuOpen] = useState(false);
	const footRef = useRef<HTMLDivElement>(null);
	const openId = (location.state as { conversationId?: string } | null)?.conversationId;

	// The chat open in the chat page, when it was started there rather than
	// opened from the list.
	const [liveId, setLiveId] = useState<string | null>(null);

	// Re-read on every navigation and whenever a chat is saved or deleted.
	// biome-ignore lint/correctness/useExhaustiveDependencies: location.key marks a navigation
	useEffect(() => {
		let alive = true;
		const load = () =>
			historyService
				.getConversations()
				.then((list) =>
					alive &&
					setRecents((prev) => {
						// Keep a just-started chat on top until its first save lands.
						const pending = (prev ?? []).filter((p) => p.pending && !list.some((c) => c.id === p.id));
						return [...pending, ...list];
					}),
				)
				.catch(() => alive && setRecents((prev) => prev ?? []));
		load();
		window.addEventListener(HISTORY_CHANGED, load);
		return () => {
			alive = false;
			window.removeEventListener(HISTORY_CHANGED, load);
		};
	}, [location.key]);

	useEffect(() => {
		const onStart = (e: Event) => {
			const { id, title } = (e as CustomEvent<{ id: string; title: string }>).detail;
			setLiveId(id);
			setRecents((prev) => [
				{ id, title, model_name: "", updated_at: new Date().toISOString(), pending: true },
				...(prev ?? []).filter((c) => c.id !== id),
			]);
		};
		window.addEventListener(CHAT_STARTED, onStart);
		return () => window.removeEventListener(CHAT_STARTED, onStart);
	}, []);

	useEffect(() => {
		if (!menuOpen) return;
		const onPointer = (e: PointerEvent) => {
			if (!footRef.current?.contains(e.target as Node)) setMenuOpen(false);
		};
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
		document.addEventListener("pointerdown", onPointer);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("pointerdown", onPointer);
			document.removeEventListener("keydown", onKey);
		};
	}, [menuOpen]);

	// Cmd/Ctrl+, opens Settings, as in most desktop apps.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === ",") {
				e.preventDefault();
				navigate("/settings");
			}
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [navigate]);

	const go = (path: string) => {
		setMenuOpen(false);
		navigate(path);
	};

	const pinned = (recents ?? []).filter((c) => pins.includes(c.id));
	const unpinned = (recents ?? []).filter((c) => !pins.includes(c.id));
	const item = (entry: ConversationMeta & { pending?: boolean }) => (
		<RecentItem
			key={entry.id}
			entry={entry}
			pinned={pins.includes(entry.id)}
			active={location.pathname === "/chat" && (openId ?? liveId) === entry.id}
			onOpen={() => {
				setLiveId(null);
				navigate("/chat", { state: { conversationId: entry.id } });
			}}
			onDeletedOpen={() => {
				setLiveId(null);
				navigate("/chat", { state: { freshChat: true } });
			}}
		/>
	);

	const isActive = (path: string, owns: readonly string[]) =>
		location.pathname === path ||
		(path !== "/chat" && location.pathname.startsWith(path)) ||
		owns.some((prefix) => location.pathname.startsWith(prefix));

	return (
		<Aside aria-label="Sidebar">
			<Brand>
				<NeurixMark size={22} knockout="rgb(var(--c-surface-container-low))" />
				<Wordmark>Neurix</Wordmark>
			</Brand>

			<Group>
				<Row
					type="button"
					onClick={() => {
						setLiveId(null);
						navigate("/chat", { state: { freshChat: true } });
					}}
				>
					<NewChatIcon>
						<Icon name="add" size={14} fill />
					</NewChatIcon>
					<span>New chat</span>
				</Row>
				<Row type="button" onClick={() => navigate("/chat/history")} $active={location.pathname === "/chat/history"}>
					<Icon name="search" size={17} />
					<span>Search chats</span>
				</Row>
				{SECTIONS.map((section) => (
					<Row
						key={section.path}
						type="button"
						$active={isActive(section.path, section.owns)}
						aria-current={isActive(section.path, section.owns) ? "page" : undefined}
						onClick={() => navigate(section.path)}
					>
						<Icon name={section.icon} size={17} />
						<span>{section.label}</span>
						{section.path === "/store" && running.length > 0 && (
							<Progress aria-label={`Downloading, ${percent} percent`}>{percent}%</Progress>
						)}
					</Row>
				))}
			</Group>

			<Recents>
				{pinned.length > 0 && <SectionLabel>Pinned</SectionLabel>}
				{pinned.map(item)}
				<SectionLabel>Recents</SectionLabel>
				{recents?.length === 0 && <Empty>No chats yet</Empty>}
				{unpinned.slice(0, RECENT_LIMIT).map(item)}
			</Recents>

			<FootWrap ref={footRef}>
				{menuOpen && (
					<Menu role="menu">
						<MenuHeader>Private · runs on this device</MenuHeader>
						<MenuItem
							type="button"
							role="menuitem"
							onClick={() => {
								setMenuOpen(false);
								window.dispatchEvent(new Event(OPEN_PALETTE));
							}}
						>
							<Icon name="command" size={16} />
							Command palette
							<kbd>{isMac() ? "⌘ K" : "Ctrl K"}</kbd>
						</MenuItem>
						<MenuItem type="button" role="menuitem" onClick={() => go("/settings")}>
							<Icon name="settings" size={16} />
							Settings
							<kbd>{isMac() ? "⌘ ," : "Ctrl ,"}</kbd>
						</MenuItem>
						<MenuItem type="button" role="menuitem" onClick={() => go("/connectors")}>
							<Icon name="plug" size={16} />
							Connectors
						</MenuItem>
						<MenuItem type="button" role="menuitem" onClick={() => go("/models")}>
							<Icon name="deployed_code" size={16} />
							Manage models
						</MenuItem>
						<MenuItem type="button" role="menuitem" onClick={() => go("/friend/new")}>
							<Icon name="diversity_3" size={16} />
							New friend
						</MenuItem>
						<MenuItem type="button" role="menuitem" onClick={() => go("/character/new")}>
							<Icon name="person" size={16} />
							New character
						</MenuItem>
						<MenuDivider />
						<MenuItem
							type="button"
							role="menuitem"
							onClick={() => {
								setMenuOpen(false);
								openUrl("https://github.com/Razee4315/neurix/issues").catch(() => {});
							}}
						>
							<Icon name="info" size={16} />
							Get help
							<Icon name="open_in_new" size={14} />
						</MenuItem>
						<MenuItem type="button" role="menuitem" onClick={() => go("/about")}>
							<Icon name="verified_user" size={16} />
							About Neurix
						</MenuItem>
					</Menu>
				)}
				<Foot type="button" $open={menuOpen} onClick={() => setMenuOpen((v) => !v)} aria-haspopup="menu" aria-expanded={menuOpen}>
					<Avatar>
						<Icon name="enhanced_encryption" size={15} />
					</Avatar>
					<FootText>
						<strong>On this device</strong>
						<span>{activeModel ? `${activeModel} · offline` : "No model loaded"}</span>
					</FootText>
					<Icon name="expand_more" size={14} />
				</Foot>
			</FootWrap>
		</Aside>
	);
}
