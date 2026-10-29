import { Icon } from "@/components/ui/Icon";
import { NeurixMark } from "@/components/ui/NeurixLogo";
import { useAppContext } from "@/context/AppContext";
import { historyService } from "@/services";
import { CHAT_STARTED, HISTORY_CHANGED } from "@/services/historyService";
import type { ConversationMeta } from "@/services/types";
import { alpha } from "@/theme/alpha";
import { tokens } from "@/theme/tokens";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import styled from "styled-components";

/**
 * The desktop sidebar: brand, new chat, the main sections, recent chats and
 * a status line at the foot. Wide windows only; phones keep `BottomNav`.
 */

const SECTIONS = [
	{ icon: "chat_bubble", label: "Chats", path: "/chat", owns: ["/character", "/friend"] },
	{ icon: "deployed_code", label: "Models", path: "/models", owns: [] },
	{ icon: "storefront", label: "Model library", path: "/store", owns: ["/downloading"] },
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
    border-right: 1px solid ${alpha(tokens.colors.outlineVariant, "80")};
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

  > span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
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

export function Sidebar() {
	const location = useLocation();
	const navigate = useNavigate();
	const { activeModel } = useAppContext();
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
						return [...pending, ...list].slice(0, RECENT_LIMIT);
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
					</Row>
				))}
			</Group>

			<SectionLabel>Recents</SectionLabel>
			<Recents>
				{recents?.length === 0 && <Empty>No chats yet</Empty>}
				{recents?.map((entry) => (
					<RecentRow
						key={entry.id}
						type="button"
						title={entry.title}
						$active={location.pathname === "/chat" && (openId ?? liveId) === entry.id}
						onClick={() => {
							setLiveId(null);
							navigate("/chat", { state: { conversationId: entry.id } });
						}}
					>
						<span>{entry.title || "Untitled chat"}</span>
					</RecentRow>
				))}
			</Recents>

			<FootWrap ref={footRef}>
				{menuOpen && (
					<Menu role="menu">
						<MenuHeader>Private · runs on this device</MenuHeader>
						<MenuItem type="button" role="menuitem" onClick={() => go("/settings")}>
							<Icon name="settings" size={16} />
							Settings
							<kbd>⌘ ,</kbd>
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
