import { AppLayout } from "@/components/layout/AppLayout";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { historyService } from "@/services";
import type { ConversationMeta } from "@/services/types";
import { tokens } from "@/theme/tokens";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled, { keyframes } from "styled-components";

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
  font-size: ${tokens.typography.fontSize.xs};
  font-weight: ${tokens.typography.fontWeight.semibold};
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

const SwipeContainer = styled.div`
  position: relative;
  overflow: hidden;
  border-radius: ${tokens.borderRadius.lg};
  animation: ${slideIn} 0.3s ease-out both;
`;

const SwipeActions = styled.div`
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 80px;
  display: flex;
  align-items: stretch;
  border-radius: 0 ${tokens.borderRadius.lg} ${tokens.borderRadius.lg} 0;
  overflow: hidden;
`;

const SwipeShareBg = styled.div`
  flex: 1;
  background: ${tokens.colors.primary};
  display: flex;
  align-items: center;
  justify-content: center;
`;

const SwipeDeleteBg = styled.div`
  flex: 1;
  background: ${tokens.colors.error};
  display: flex;
  align-items: center;
  justify-content: center;
`;

const ChatItem = styled.div<{ $offset?: number }>`
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
  transition: ${({ $offset }) => $offset === 0 ? `transform 0.2s ease-out` : "none"};
  transform: translateX(${({ $offset }) => $offset ?? 0}px);
  position: relative;
  z-index: 1;

  &:active { background: ${tokens.colors.surfaceContainerHigh}; }
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

const RenameInput = styled.input`
  width: 100%;
  background: ${tokens.colors.surfaceContainerHighest};
  border: 1px solid ${tokens.colors.primary};
  border-radius: ${tokens.borderRadius.sm};
  padding: 0.25rem 0.375rem;
  font-size: ${tokens.typography.fontSize.base};
  font-weight: ${tokens.typography.fontWeight.medium};
  color: ${tokens.colors.onSurface};
  outline: none;
`;

const EditBtn = styled.button`
  background: none;
  border: none;
  padding: 0.25rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  opacity: 0.5;
  transition: opacity ${tokens.transitions.fast};

  &:hover { opacity: 1; }
  &:active { transform: scale(0.9); }
`;

/* ── Swipeable Row ── */

function SwipeableRow({
	renderItem,
	onDelete,
	onShare,
}: { renderItem: (offset: number) => React.ReactNode; onDelete: () => void; onShare: () => void }) {
	const [offset, setOffset] = useState(0);
	const startXRef = useRef(0);
	const currentXRef = useRef(0);
	const swipingRef = useRef(false);

	const handleTouchStart = (e: React.TouchEvent) => {
		startXRef.current = e.touches[0].clientX;
		currentXRef.current = 0;
		swipingRef.current = false;
	};

	const handleTouchMove = (e: React.TouchEvent) => {
		const diff = e.touches[0].clientX - startXRef.current;
		if (diff < -10) swipingRef.current = true;
		if (swipingRef.current) {
			const clamped = Math.max(Math.min(diff, 0), -80);
			currentXRef.current = clamped;
			setOffset(clamped);
		}
	};

	const handleTouchEnd = () => {
		if (currentXRef.current < -50) {
			setOffset(-80);
		} else {
			setOffset(0);
		}
		swipingRef.current = false;
	};

	return (
		<SwipeContainer>
			<SwipeActions>
				<SwipeShareBg onClick={onShare}>
					<Icon name="share" size={18} color="#fff" />
				</SwipeShareBg>
				<SwipeDeleteBg onClick={onDelete}>
					<Icon name="delete" size={18} color="#fff" />
				</SwipeDeleteBg>
			</SwipeActions>
			<div
				onTouchStart={handleTouchStart}
				onTouchMove={handleTouchMove}
				onTouchEnd={handleTouchEnd}
			>
				{renderItem(offset)}
			</div>
		</SwipeContainer>
	);
}

/* ── Component ── */

function groupByDate(conversations: ConversationMeta[]): Record<string, ConversationMeta[]> {
	const groups: Record<string, ConversationMeta[]> = {};
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const yesterday = new Date(today.getTime() - 86400000);

	for (const conv of conversations) {
		const date = new Date(conv.updated_at);
		const convDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

		let label: string;
		if (convDay.getTime() === today.getTime()) {
			label = "Today";
		} else if (convDay.getTime() === yesterday.getTime()) {
			label = "Yesterday";
		} else {
			label = convDay.toLocaleDateString(undefined, { month: "short", day: "numeric" });
		}

		if (!groups[label]) groups[label] = [];
		groups[label].push(conv);
	}

	return groups;
}

function formatTime(dateStr: string): string {
	return new Date(dateStr).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function ChatHistoryPage() {
	const navigate = useNavigate();
	const { showConfirm } = useConfirm();
	const { showToast } = useToast();
	const [search, setSearch] = useState("");
	const [conversations, setConversations] = useState<ConversationMeta[]>([]);
	const [renamingId, setRenamingId] = useState<string | null>(null);
	const [renameValue, setRenameValue] = useState("");

	const refresh = useCallback(async () => {
		const list = await historyService.getConversations();
		setConversations(list);
	}, []);

	useEffect(() => {
		refresh();
	}, [refresh]);

	const handleDeleteOne = async (id: string, title: string) => {
		const ok = await showConfirm({
			title: "Delete Conversation",
			message: `Delete "${title}"?`,
			confirmLabel: "Delete",
			cancelLabel: "Cancel",
			danger: true,
		});
		if (!ok) return;
		if (navigator.vibrate) navigator.vibrate(12);
		await historyService.deleteConversation(id);
		setConversations((prev) => prev.filter((c) => c.id !== id));
	};

	const handleExport = async (id: string, title: string) => {
		const conv = await historyService.loadConversation(id);
		if (!conv) return;

		const lines = [
			`# ${title}`,
			`Model: ${conv.model_name}`,
			`Date: ${new Date(conv.created_at).toLocaleDateString()}`,
			"",
			...conv.messages.map((m) =>
				`**${m.role === "user" ? "You" : "Neurix"}**: ${m.content}`
			),
		];
		const text = lines.join("\n\n");

		if (navigator.share) {
			try {
				await navigator.share({ title: `Neurix - ${title}`, text });
				return;
			} catch {
				// Cancelled or failed
			}
		}
		await navigator.clipboard.writeText(text);
	};

	const handleStartRename = (id: string, currentTitle: string) => {
		setRenamingId(id);
		setRenameValue(currentTitle);
	};

	const handleFinishRename = async () => {
		if (!renamingId || !renameValue.trim()) {
			setRenamingId(null);
			return;
		}
		try {
			const conv = await historyService.loadConversation(renamingId);
			if (conv) {
				conv.title = renameValue.trim();
				await historyService.saveConversation(conv);
				setConversations((prev) =>
					prev.map((c) => c.id === renamingId ? { ...c, title: renameValue.trim() } : c),
				);
				showToast("Conversation renamed", "success");
			}
		} catch {
			showToast("Failed to rename", "error");
		}
		setRenamingId(null);
	};

	const handleClearAll = async () => {
		const ok = await showConfirm({
			title: "Clear History",
			message: "Delete all chat history? This cannot be undone.",
			confirmLabel: "Delete All",
			cancelLabel: "Cancel",
			danger: true,
		});
		if (!ok) return;
		await historyService.clearAllConversations();
		setConversations([]);
	};

	const filtered = conversations.filter(
		(c) => !search || c.title.toLowerCase().includes(search.toLowerCase()),
	);

	const groups = groupByDate(filtered);

	return (
		<AppLayout title="Chat History">
			<Page>
				<Header>
					<ClearBtn onClick={handleClearAll}>Clear all</ClearBtn>
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

				{Object.keys(groups).length === 0 ? (
					<EmptyState
						icon="chat_bubble"
						message={conversations.length === 0 ? "No conversations yet" : "No conversations match your search"}
					/>
				) : (
					Object.entries(groups).map(([label, items]) => (
						<div key={label}>
							<GroupLabel>
								<GroupText>{label}</GroupText>
								<GroupLine />
							</GroupLabel>
							<ChatList>
								{items.map((entry) => (
									<SwipeableRow
										key={entry.id}
										onDelete={() => handleDeleteOne(entry.id, entry.title)}
										onShare={() => handleExport(entry.id, entry.title)}
										renderItem={(offset) => (
											<ChatItem
												$offset={offset}
												onClick={() => {
													if (offset === 0 && renamingId !== entry.id) navigate("/chat", { state: { conversationId: entry.id } });
												}}
											>
												<ChatIcon>
													<Icon name="chat_bubble" size={18} color={tokens.colors.onSurfaceVariant} />
												</ChatIcon>
												<ChatInfo>
													{renamingId === entry.id ? (
														<RenameInput
															value={renameValue}
															onChange={(e) => setRenameValue(e.target.value)}
															onBlur={handleFinishRename}
															onKeyDown={(e) => {
																if (e.key === "Enter") handleFinishRename();
																if (e.key === "Escape") setRenamingId(null);
															}}
															autoFocus
															onClick={(e) => e.stopPropagation()}
														/>
													) : (
														<ChatTitle>{entry.title}</ChatTitle>
													)}
													<ChatMeta>
														{entry.model_name} · {formatTime(entry.updated_at)}
													</ChatMeta>
												</ChatInfo>
												{renamingId !== entry.id && (
													<EditBtn onClick={(e) => {
														e.stopPropagation();
														handleStartRename(entry.id, entry.title);
													}}>
														<Icon name="edit" size={16} color={tokens.colors.onSurfaceVariant} />
													</EditBtn>
												)}
											</ChatItem>
										)}
									/>
								))}
							</ChatList>
						</div>
					))
				)}
			</Page>
		</AppLayout>
	);
}
