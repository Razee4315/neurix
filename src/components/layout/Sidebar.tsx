import { Icon } from "@/components/ui/Icon";
import { NeurixMark } from "@/components/ui/NeurixLogo";
import { useAppContext } from "@/context/AppContext";
import { historyService } from "@/services";
import type { ConversationMeta } from "@/services/types";
import { alpha } from "@/theme/alpha";
import { tokens } from "@/theme/tokens";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import styled from "styled-components";

/**
 * The desktop sidebar: brand, new chat, the main sections, recent chats and
 * a status line at the foot. Wide windows only; phones keep `BottomNav`.
 */

const SECTIONS = [
	{ icon: "chat_bubble", label: "Chats", path: "/chat", owns: ["/character"] },
	{ icon: "deployed_code", label: "Models", path: "/models", owns: [] },
	{ icon: "storefront", label: "Model library", path: "/store", owns: ["/downloading"] },
	{ icon: "plug", label: "Connectors", path: "/connectors", owns: [] },
	{ icon: "settings", label: "Settings", path: "/settings", owns: ["/about"] },
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

const Foot = styled.div`
  display: flex;
  align-items: center;
  gap: 0.625rem;
  margin-top: 0.5rem;
  padding: 0.625rem;
  border-top: 1px solid ${alpha(tokens.colors.outlineVariant, "80")};
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
	const [recents, setRecents] = useState<ConversationMeta[] | null>(null);
	const openId = (location.state as { conversationId?: string } | null)?.conversationId;

	// Re-read on every navigation so a chat saved a moment ago shows up.
	// biome-ignore lint/correctness/useExhaustiveDependencies: location.key marks a navigation
	useEffect(() => {
		let alive = true;
		historyService
			.getConversations()
			.then((list) => alive && setRecents(list.slice(0, RECENT_LIMIT)))
			.catch(() => alive && setRecents([]));
		return () => {
			alive = false;
		};
	}, [location.key]);

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
				<Row type="button" onClick={() => navigate("/chat", { state: { freshChat: true } })}>
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
						$active={location.pathname === "/chat" && openId === entry.id}
						onClick={() => navigate("/chat", { state: { conversationId: entry.id } })}
					>
						<span>{entry.title || "Untitled chat"}</span>
					</RecentRow>
				))}
			</Recents>

			<Foot>
				<Avatar>
					<Icon name="enhanced_encryption" size={15} />
				</Avatar>
				<FootText>
					<strong>On this device</strong>
					<span>{activeModel ? `${activeModel} · offline` : "No model loaded"}</span>
				</FootText>
			</Foot>
		</Aside>
	);
}
