import { AppLayout } from "@/components/layout/AppLayout";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { tokens } from "@/theme/tokens";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import styled, { keyframes } from "styled-components";

/* ── Mock Data ── */

interface ChatEntry {
	title: string;
	model: string;
	time: string;
	icon: string;
}

const TODAY: ChatEntry[] = [
	{
		title: "Neural networks explained",
		model: "Llama 3 8B",
		time: "10:42 AM",
		icon: "school",
	},
	{
		title: "Python script help",
		model: "Llama 3 8B",
		time: "08:15 AM",
		icon: "terminal",
	},
];

const YESTERDAY: ChatEntry[] = [
	{
		title: "Vacation planning",
		model: "Llama 3 8B",
		time: "6:30 PM",
		icon: "travel",
	},
	{
		title: "Quarterly review summary",
		model: "Mistral 7B",
		time: "3:15 PM",
		icon: "analytics",
	},
	{
		title: "Short story ideas",
		model: "Llama 3 8B",
		time: "11:00 AM",
		icon: "edit_note",
	},
];

/* ── Styles ── */

const Page = styled.div`
  padding: 1.25rem;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
`;

const Title = styled.h1`
  font-family: ${tokens.typography.fontFamily.headline};
  font-size: clamp(1.75rem, 6vw, 2.25rem);
  font-weight: ${tokens.typography.fontWeight.bold};
  color: ${tokens.colors.onSurface};
`;

const ClearBtn = styled.button`
  background: none;
  border: none;
  font-size: ${tokens.typography.fontSize.sm};
  color: ${tokens.colors.onSurfaceVariant};
  cursor: pointer;

  &:hover { color: ${tokens.colors.error}; }
`;

const SearchBox = styled.div`
  position: relative;
  margin-bottom: 1.25rem;
`;

const SearchInput = styled.input`
  width: 100%;
  height: 44px;
  padding: 0 1rem 0 2.5rem;
  background: ${tokens.colors.surfaceContainerHighest};
  border: none;
  border-radius: ${tokens.borderRadius.lg};
  font-size: ${tokens.typography.fontSize.base};
  color: ${tokens.colors.onSurface};
  outline: none;

  &::placeholder { color: ${tokens.colors.outline}; }
  &:focus { box-shadow: inset 0 -2px 0 ${tokens.colors.primary}; }
`;

const SearchIconWrap = styled.div`
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  color: ${tokens.colors.onSurfaceVariant};
  display: flex;
`;

/* ── Groups ── */

const GroupLabel = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
  margin-top: 0.5rem;
`;

const GroupText = styled.span`
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: ${tokens.typography.letterSpacing.widest};
  color: ${tokens.colors.onSurfaceVariant};
  flex-shrink: 0;
`;

const GroupLine = styled.div`
  flex: 1;
  height: 1px;
  background: ${tokens.colors.surfaceContainerHigh};
`;

/* ── Chat Items ── */

const ChatList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
`;

const slideIn = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
`;

const ChatItem = styled.button`
  width: 100%;
  text-align: left;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: ${tokens.colors.surfaceContainerLow};
  border: none;
  border-radius: ${tokens.borderRadius.lg};
  cursor: pointer;
  transition: background ${tokens.transitions.fast};
  animation: ${slideIn} 0.3s ease-out both;

  &:hover { background: ${tokens.colors.surfaceContainerHigh}; }
  &:active { transform: scale(0.99); }
`;

const ChatIcon = styled.div`
  width: 40px;
  height: 40px;
  border-radius: ${tokens.borderRadius.lg};
  background: ${tokens.colors.surfaceContainerHighest};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

const ChatInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const ChatTitle = styled.span`
  display: block;
  font-size: ${tokens.typography.fontSize.base};
  font-weight: ${tokens.typography.fontWeight.medium};
  color: ${tokens.colors.onSurface};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ChatMeta = styled.span`
  font-size: ${tokens.typography.fontSize.sm};
  color: ${tokens.colors.onSurfaceVariant};
`;

/* ── Component ── */

export function ChatHistoryPage() {
	const navigate = useNavigate();
	const [search, setSearch] = useState("");

	const filterEntries = (entries: ChatEntry[]) =>
		entries.filter(
			(e) => !search || e.title.toLowerCase().includes(search.toLowerCase()),
		);

	const renderGroup = (label: string, entries: ChatEntry[]) => {
		const items = filterEntries(entries);
		if (items.length === 0) return null;
		return (
			<>
				<GroupLabel>
					<GroupText>{label}</GroupText>
					<GroupLine />
				</GroupLabel>
				<ChatList>
					{items.map((entry) => (
						<ChatItem key={entry.title} onClick={() => navigate("/chat")}>
							<ChatIcon>
								<Icon
									name={entry.icon}
									size={18}
									color={tokens.colors.onSurfaceVariant}
								/>
							</ChatIcon>
							<ChatInfo>
								<ChatTitle>{entry.title}</ChatTitle>
								<ChatMeta>
									{entry.model} · {entry.time}
								</ChatMeta>
							</ChatInfo>
						</ChatItem>
					))}
				</ChatList>
			</>
		);
	};

	return (
		<AppLayout>
			<Page>
				<Header>
					<Title>Chat History</Title>
					<ClearBtn>Clear all</ClearBtn>
				</Header>

				<SearchBox>
					<SearchIconWrap>
						<Icon name="search" size={18} />
					</SearchIconWrap>
					<SearchInput
						placeholder="Search chats..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
					/>
				</SearchBox>

				{renderGroup("Today", TODAY)}
				{renderGroup("Yesterday", YESTERDAY)}
				{filterEntries(TODAY).length === 0 &&
					filterEntries(YESTERDAY).length === 0 && (
						<EmptyState
							icon="chat_bubble"
							message="No conversations match your search"
						/>
					)}
			</Page>
		</AppLayout>
	);
}
