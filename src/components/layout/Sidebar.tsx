import { OPEN_PALETTE } from "@/components/CommandPalette";
import { Icon } from "@/components/ui/Icon";
import { NeurixMark } from "@/components/ui/NeurixLogo";
import { useToast } from "@/components/ui/Toast";
import { useAppContext } from "@/context/AppContext";
import { useDownloads } from "@/context/DownloadContext";
import { historyService } from "@/services";
import { CHAT_SAVE_FAILED, CHAT_STARTED, HISTORY_CHANGED } from "@/services/historyService";
import { alpha } from "@/theme/alpha";
import { tokens } from "@/theme/tokens";
import { togglePin, usePins } from "@/utils/pins";
import { isMac } from "@/utils/platform";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import styled, { keyframes } from "styled-components";
import { type RecentEntry, addPending, dropPending, mergeSaved } from "./recents";

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
    width: 256px;
    min-height: 0;
    /* The navigation plane: recessed below the reading plane, set off by a
       single hairline rather than a shadow. */
    background: ${tokens.colors.surfaceContainerLow};
    border-right: 1px solid ${tokens.colors.outlineVariant};
    padding: 0.5rem 0.5rem 0.5rem;
  }
`;

const Brand = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  height: 40px;
  padding: 0 0.25rem 0 0.625rem;
  /* Clear of macOS's traffic lights (see TitleBar.tsx). */
  padding-left: calc(0.625rem + var(--window-inset-left, 0px));
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
    flex: 1;
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

/* New chat is an ordinary row with an outline glyph: no filled accent disc. */
const NewChatIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: ${tokens.colors.primary};
`;

const Shortcut = styled.kbd`
  margin-left: auto;
  flex-shrink: 0;
  font-family: ${tokens.typography.fontFamily.mono};
  font-size: ${tokens.typography.fontSize["2xs"]};
  color: ${tokens.colors.outline};
  opacity: 0;
  transition: opacity ${tokens.transitions.fast};

  button:hover > &, button:focus-visible > & { opacity: 1; }
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

/* ── The Local Engine pill, at the foot of the sidebar ──

   What the app is running on: the model in memory, its KV cache precision
   and whether Air-Gap is on. A click opens the engine popover; the gear
   beside it goes straight to Settings. */

const FootWrap = styled.div`
  position: relative;
  display: flex;
  align-items: stretch;
  gap: 0.25rem;
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid ${tokens.colors.outlineVariant};
`;

const EnginePill = styled.button<{ $open: boolean }>`
  position: relative;
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4375rem 0.625rem;
  border: 1px solid ${({ $open }) => ($open ? tokens.colors.outline : tokens.colors.outlineVariant)};
  border-radius: ${tokens.borderRadius.lg};
  background: ${({ $open }) => ($open ? tokens.colors.surfaceContainerHigh : tokens.colors.surfaceContainer)};
  color: ${tokens.colors.onSurface};
  text-align: left;
  cursor: pointer;
  overflow: hidden;
  transition: background ${tokens.transitions.fast}, border-color ${tokens.transitions.fast};

  &:hover { background: ${tokens.colors.surfaceContainerHigh}; border-color: ${tokens.colors.outline}; }
`;

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
`;

const sweep = keyframes`
  from { transform: translateX(-100%); }
  to { transform: translateX(250%); }
`;

const StatusDot = styled.span<{ $state: "ready" | "loading" | "idle" }>`
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  box-sizing: border-box;
  background: ${({ $state }) =>
		$state === "ready"
			? tokens.colors.primary
			: $state === "loading"
				? tokens.colors.secondary
				: "transparent"};
  border: ${({ $state }) => ($state === "idle" ? `1.5px solid ${tokens.colors.outline}` : "none")};
  animation: ${({ $state }) => ($state === "loading" ? pulse : "none")} 1.4s ease-in-out infinite;
`;

/* A quiet warming bar along the pill's lower edge while weights map in. */
const WarmingBar = styled.span`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 2px;
  overflow: hidden;
  background: ${alpha(tokens.colors.secondary, "26")};

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    width: 40%;
    background: ${tokens.colors.secondary};
    animation: ${sweep} 1.6s ${tokens.animation.easing.standard} infinite;
  }
`;

const EngineText = styled.span`
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
  line-height: 1.25;

  strong {
    font-size: ${tokens.typography.fontSize.sm};
    font-weight: ${tokens.typography.fontWeight.medium};
    color: ${tokens.colors.onSurface};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  > span {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    min-width: 0;
    font-size: ${tokens.typography.fontSize["2xs"]};
    color: ${tokens.colors.onSurfaceVariant};
    white-space: nowrap;
  }
`;

const Badge = styled.span<{ $tone?: "primary" | "secondary" }>`
  display: inline-flex;
  align-items: center;
  gap: 0.1875rem;
  height: 16px;
  padding: 0 0.3125rem;
  border: 1px solid
    ${({ $tone }) => ($tone === "primary" ? alpha(tokens.colors.primary, "66") : tokens.colors.outlineVariant)};
  border-radius: ${tokens.borderRadius.sm};
  font-family: ${tokens.typography.fontFamily.mono};
  font-size: 0.625rem;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
  color: ${({ $tone }) => ($tone === "primary" ? tokens.colors.primary : tokens.colors.secondary)};
  flex-shrink: 0;
`;

const GearBtn = styled.button`
  flex-shrink: 0;
  width: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid ${tokens.colors.outlineVariant};
  border-radius: ${tokens.borderRadius.lg};
  background: ${tokens.colors.surfaceContainer};
  color: ${tokens.colors.onSurfaceVariant};
  cursor: pointer;
  transition: background ${tokens.transitions.fast}, color ${tokens.transitions.fast};

  &:hover { background: ${tokens.colors.surfaceContainerHigh}; color: ${tokens.colors.onSurface}; }
`;

/* The engine popover, opening upwards from the pill. */
const Menu = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(100% + 6px);
  padding: 0.375rem;
  background: ${tokens.colors.surfaceContainer};
  border: 1px solid ${tokens.colors.outlineVariant};
  border-radius: ${tokens.borderRadius.xl};
  z-index: ${tokens.zIndex.overlay};
`;

const MenuHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  padding: 0.375rem 0.625rem 0.5rem;

  strong {
    font-size: ${tokens.typography.fontSize.sm};
    font-weight: ${tokens.typography.fontWeight.semibold};
    color: ${tokens.colors.onSurface};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  span {
    font-size: ${tokens.typography.fontSize.xs};
    color: ${tokens.colors.onSurfaceVariant};
  }
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
  &:disabled { opacity: 0.45; cursor: default; background: transparent; }
  > kbd, > em {
    margin-left: auto;
    font-family: ${tokens.typography.fontFamily.mono};
    font-style: normal;
    font-size: ${tokens.typography.fontSize["2xs"]};
    color: ${tokens.colors.onSurfaceVariant};
  }
`;

const MenuDivider = styled.div`
  height: 1px;
  margin: 0.375rem 0.25rem;
  background: ${tokens.colors.outlineVariant};
`;

/* ── Collapse: hide the sidebar on desktop (Ctrl+B), remembered across launches ── */

const COLLAPSE_KEY = "neurix.sidebar.collapsed";
const collapseListeners = new Set<() => void>();

function readCollapsed(): boolean {
	try {
		return localStorage.getItem(COLLAPSE_KEY) === "1";
	} catch {
		return false;
	}
}

let collapsed = readCollapsed();

function setSidebarCollapsed(next: boolean): void {
	if (next === collapsed) return;
	collapsed = next;
	try {
		localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
	} catch {
		// Storage unavailable: still applies for this session.
	}
	for (const listener of collapseListeners) listener();
}

/** Show or hide the desktop sidebar. */
export function toggleSidebar(): void {
	setSidebarCollapsed(!collapsed);
}

function subscribeCollapsed(listener: () => void): () => void {
	collapseListeners.add(listener);
	return () => collapseListeners.delete(listener);
}

/** Whether the desktop sidebar is hidden. */
export function useSidebarCollapsed(): boolean {
	return useSyncExternalStore(
		subscribeCollapsed,
		() => collapsed,
		() => false,
	);
}

/* A panel-with-rail glyph, drawn for this button rather than borrowed. */
export function SidebarGlyph({ size = 18 }: { size?: number }) {
	return (
		<svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
			<rect x="2.5" y="3.5" width="15" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" />
			<path d="M8 3.5v13" stroke="currentColor" strokeWidth="1.5" />
			<path d="M4.75 7h1.5M4.75 10h1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
		</svg>
	);
}

/** The button that shows and hides the sidebar. */
export const SidebarToggle = styled.button`
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: none;
  border-radius: ${tokens.borderRadius.md};
  background: transparent;
  color: ${tokens.colors.onSurfaceVariant};
  cursor: pointer;
  transition: background ${tokens.transitions.fast}, color ${tokens.transitions.fast};

  &:hover { background: ${tokens.colors.surfaceContainerHigh}; color: ${tokens.colors.onSurface}; }
`;

const MOD_LABEL = isMac() ? "⌘" : "Ctrl+";

interface RecentItemProps {
	entry: RecentEntry;
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
	const { showToast } = useToast();
	const { modelStatus, activeModel, activeModelInfo, settings, updateSettings, unloadModel } =
		useAppContext();
	const { downloads } = useDownloads();
	const pins = usePins();
	const isCollapsed = useSidebarCollapsed();
	const running = Object.values(downloads).filter(
		(d) => d.status === "downloading" || d.status === "verifying",
	);
	const total = running.reduce((sum, d) => sum + d.totalBytes, 0);
	const done = running.reduce((sum, d) => sum + d.downloadedBytes, 0);
	const percent = total > 0 ? Math.floor((done / total) * 100) : 0;
	const [recents, setRecents] = useState<RecentEntry[] | null>(null);
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
				// Keeps a just-started chat on top until its first save lands.
				.then((list) => alive && setRecents((prev) => mergeSaved(prev, list)))
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
			setRecents((prev) => addPending(prev, id, title));
		};
		const onSaveFailed = (e: Event) => {
			const { id } = (e as CustomEvent<{ id: string }>).detail;
			setRecents((prev) => dropPending(prev, id));
		};
		window.addEventListener(CHAT_STARTED, onStart);
		window.addEventListener(CHAT_SAVE_FAILED, onSaveFailed);
		return () => {
			window.removeEventListener(CHAT_STARTED, onStart);
			window.removeEventListener(CHAT_SAVE_FAILED, onSaveFailed);
		};
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

	// Cmd/Ctrl+, opens Settings and Cmd/Ctrl+B shows or hides the sidebar,
	// as in most desktop apps.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return;
			if (e.key === ",") {
				e.preventDefault();
				navigate("/settings");
			} else if (e.key.toLowerCase() === "b") {
				e.preventDefault();
				toggleSidebar();
			}
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [navigate]);

	// Pages can read this to drop controls the sidebar already offers.
	useEffect(() => {
		document.documentElement.dataset.sidebar = isCollapsed ? "collapsed" : "open";
	}, [isCollapsed]);

	const go = (path: string) => {
		setMenuOpen(false);
		navigate(path);
	};

	const engineState = modelStatus.kind;
	const quant = activeModelInfo?.kv_cache_quant?.toUpperCase();
	const airGap = settings?.air_gap === true;
	const engineName =
		modelStatus.kind === "ready"
			? (activeModel ?? "Model ready")
			: modelStatus.kind === "loading"
				? "Warming up..."
				: "No model loaded";
	const engineDetail =
		modelStatus.kind === "ready" ? "Ready · local" : modelStatus.kind === "loading" ? modelStatus.id : "Idle";

	const toggleAirGap = async () => {
		setMenuOpen(false);
		try {
			const stored = await updateSettings({ air_gap: !airGap });
			showToast(stored.air_gap ? "Air-Gap on: nothing leaves this device" : "Air-Gap off", "info");
		} catch {
			showToast("Couldn't change Air-Gap mode", "error");
		}
	};

	const unload = async () => {
		setMenuOpen(false);
		try {
			await unloadModel();
		} catch {
			showToast("Couldn't unload the model", "error");
		}
	};

	const pinned = (recents ?? []).filter((c) => pins.includes(c.id));
	const unpinned = (recents ?? []).filter((c) => !pins.includes(c.id));
	const item = (entry: RecentEntry) => (
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

	if (isCollapsed) return null;

	return (
		<Aside aria-label="Sidebar">
			{/* Part of the window's title bar on desktop: drags the window. */}
			<Brand data-tauri-drag-region>
				<NeurixMark size={22} knockout="rgb(var(--c-surface-container-low))" />
				<Wordmark data-tauri-drag-region>Neurix</Wordmark>
				<SidebarToggle
					type="button"
					style={{ marginLeft: "auto" }}
					aria-label="Hide sidebar"
					title={`Hide sidebar (${MOD_LABEL}B)`}
					onClick={toggleSidebar}
				>
					<SidebarGlyph />
				</SidebarToggle>
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
						<Icon name="edit_square" size={17} />
					</NewChatIcon>
					<span>New chat</span>
					<Shortcut>{MOD_LABEL}N</Shortcut>
				</Row>
				<Row
					type="button"
					onClick={() => navigate("/chat/history")}
					$active={location.pathname === "/chat/history"}
				>
					<Icon name="search" size={17} />
					<span>Search chats</span>
					<Shortcut>{MOD_LABEL}⇧F</Shortcut>
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
					<Menu role="menu" aria-label="Local engine">
						<MenuHeader>
							<strong>{engineName}</strong>
							<span>
								{modelStatus.kind === "ready"
									? `Running on this device${quant ? ` · KV ${quant}` : ""}`
									: modelStatus.kind === "loading"
										? "Mapping weights into memory"
										: "Pick a model to start chatting"}
							</span>
						</MenuHeader>
						<MenuItem type="button" role="menuitem" onClick={() => go("/models")}>
							<Icon name="deployed_code" size={16} />
							{modelStatus.kind === "ready" ? "Switch model" : "My models"}
						</MenuItem>
						<MenuItem type="button" role="menuitem" disabled={modelStatus.kind !== "ready"} onClick={unload}>
							<Icon name="power_settings_new" size={16} />
							Unload model
						</MenuItem>
						<MenuItem
							type="button"
							role="menuitemcheckbox"
							aria-checked={airGap}
							disabled={!settings}
							onClick={toggleAirGap}
						>
							<Icon name="shield" size={16} />
							Air-Gap mode
							<em>{airGap ? "On" : "Off"}</em>
						</MenuItem>
						<MenuDivider />
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
							<kbd>{MOD_LABEL}K</kbd>
						</MenuItem>
						<MenuItem type="button" role="menuitem" onClick={() => go("/settings")}>
							<Icon name="settings" size={16} />
							Settings
							<kbd>{MOD_LABEL},</kbd>
						</MenuItem>
						<MenuItem type="button" role="menuitem" onClick={() => go("/about")}>
							<Icon name="info" size={16} />
							About Neurix
						</MenuItem>
						<MenuItem
							type="button"
							role="menuitem"
							onClick={() => {
								setMenuOpen(false);
								openUrl("https://github.com/Razee4315/neurix/issues").catch(() => {});
							}}
						>
							<Icon name="open_in_new" size={16} />
							Get help
						</MenuItem>
					</Menu>
				)}
				<EnginePill
					type="button"
					$open={menuOpen}
					onClick={() => setMenuOpen((v) => !v)}
					aria-haspopup="menu"
					aria-expanded={menuOpen}
					aria-label={`Local engine: ${engineName}${airGap ? ", Air-Gap on" : ""}`}
				>
					<StatusDot $state={engineState} aria-hidden="true" />
					<EngineText>
						<strong>{engineName}</strong>
						<span>
							<span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{engineDetail}</span>
						</span>
					</EngineText>
					{modelStatus.kind === "ready" && quant && <Badge>{quant}</Badge>}
					{airGap && (
						<Badge $tone="primary" title="Air-Gap on">
							<Icon name="shield" size={10} />
						</Badge>
					)}
					{modelStatus.kind === "loading" && <WarmingBar aria-hidden="true" />}
				</EnginePill>
				<GearBtn
					type="button"
					aria-label="Settings"
					title={`Settings (${MOD_LABEL},)`}
					onClick={() => go("/settings")}
				>
					<Icon name="settings" size={17} />
				</GearBtn>
			</FootWrap>
		</Aside>
	);
}
