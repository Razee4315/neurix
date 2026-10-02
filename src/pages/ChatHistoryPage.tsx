import { AppLayout } from "@/components/layout/AppLayout";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { useCharacters } from "@/context/CharacterContext";
import { historyService } from "@/services";
import type { ConversationMeta } from "@/services/types";
import { alpha } from "@/theme/alpha";
import { tokens } from "@/theme/tokens";
import { accentOf } from "@/utils/characterAccent";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { vibrate } from "@/utils/platform";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled, { keyframes } from "styled-components";

/* ── Styles ── */

const Page = styled.div`
  padding: 1.25rem;
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

/* ── Character filter chips ──
 * Horizontal-scroll chip rail above the chat list. "All" is always
 * shown; each character that owns at least one saved conversation gets
 * a chip. The list collapses entirely when the user has no characters
 * with chats yet. */

const FilterRail = styled.div`
  display: flex;
  gap: 0.375rem;
  overflow-x: auto;
  margin-bottom: 1rem;
  padding-bottom: 0.25rem;
  -webkit-overflow-scrolling: touch;

  &::-webkit-scrollbar { height: 0; }
  scrollbar-width: none;
`;

const FilterChip = styled.button<{ $active: boolean; $accent: string }>`
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  flex-shrink: 0;
  border-radius: ${tokens.borderRadius.circle};
  border: 1px solid ${({ $active, $accent }) => ($active ? $accent : alpha(tokens.colors.outlineVariant, "60"))};
  background: ${({ $active, $accent }) =>
		$active ? alpha($accent, "14") : tokens.colors.surfaceContainerLow};
  color: ${({ $active, $accent }) => ($active ? $accent : tokens.colors.onSurfaceVariant)};
  font-size: ${tokens.typography.fontSize.xs};
  font-weight: ${tokens.typography.fontWeight.semibold};
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  white-space: nowrap;
  transition: background ${tokens.transitions.fast}, border-color ${tokens.transitions.fast};

  &:active { transform: scale(0.96); }
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

const ChatItem = styled.div`
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
  &:active { background: ${tokens.colors.surfaceContainerHighest}; }
`;

const ChatIcon = styled.div<{ $accent?: string }>`
  width: 40px;
  height: 40px;
  border-radius: ${tokens.borderRadius.lg};
  background: ${({ $accent }) =>
		$accent ? alpha($accent, "1f") : tokens.colors.surfaceContainerHighest};
  border: 1px solid
    ${({ $accent }) => ($accent ? alpha($accent, "3a") : "transparent")};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

/* Skeleton row used while the conversations list is being fetched. Without
   this the page flashes "No conversations yet" for a frame even when there
   are dozens of entries on disk. */

const skeletonShine = keyframes`
  0% { background-position: -200px 0; }
  100% { background-position: calc(200px + 100%) 0; }
`;

const SkeletonRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: ${tokens.colors.surfaceContainerLow};
  border-radius: ${tokens.borderRadius.lg};
`;

const SkeletonBlock = styled.div<{ $w: string; $h: string }>`
  width: ${({ $w }) => $w};
  height: ${({ $h }) => $h};
  border-radius: ${tokens.borderRadius.md};
  background: linear-gradient(
    90deg,
    ${tokens.colors.surfaceContainerHigh} 0%,
    ${tokens.colors.surfaceContainerHighest} 50%,
    ${tokens.colors.surfaceContainerHigh} 100%
  );
  background-size: 200px 100%;
  background-repeat: no-repeat;
  animation: ${skeletonShine} 1.4s ease-in-out infinite;
`;

const SkeletonStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  flex: 1;
`;

const StartChatBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  border-radius: ${tokens.borderRadius.lg};
  background: ${tokens.colors.primary};
  color: ${tokens.colors.onPrimaryFixed};
  font-size: ${tokens.typography.fontSize.sm};
  font-weight: ${tokens.typography.fontWeight.bold};
  border: none;
  cursor: pointer;
  margin-top: 0.75rem;
  -webkit-tap-highlight-color: transparent;

  &:active { transform: scale(0.96); }
`;

const EmptyWrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 1rem;
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

const ActionBtn = styled.button<{ $danger?: boolean }>`
  width: 44px;
  height: 44px;
  background: ${({ $danger }) => $danger ? alpha(tokens.colors.error, "12") : tokens.colors.surfaceContainerHighest};
  border: none;
  border-radius: ${tokens.borderRadius.lg};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all ${tokens.transitions.fast};

  &:hover {
    background: ${({ $danger }) => $danger ? alpha(tokens.colors.error, "22") : tokens.colors.surfaceBright};
  }
  &:active { transform: scale(0.9); }
`;

const ActionGroup = styled.div`
  display: flex;
  gap: 0.25rem;
  flex-shrink: 0;
`;

/* ── Component ── */

const RowButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
  min-width: 0;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  border-radius: ${tokens.borderRadius.lg};
`;

const Snippet = styled.div`
  font-size: ${tokens.typography.fontSize.xs};
  color: ${tokens.colors.onSurfaceVariant};
  margin-top: 0.125rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const RetryBtn = styled(StartChatBtn)``;

function groupByDate(conversations: ConversationMeta[]): [string, ConversationMeta[]][] {
	const groups = new Map<string, ConversationMeta[]>();
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
			// Include the year once a chat is from a different one, so two
			// Decembers don't merge into a single group.
			label = convDay.toLocaleDateString(undefined, {
				month: "short",
				day: "numeric",
				...(convDay.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
			});
		}

		const list = groups.get(label);
		if (list) list.push(conv);
		else groups.set(label, [conv]);
	}

	return [...groups.entries()];
}

function formatTime(dateStr: string): string {
	return new Date(dateStr).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function ChatHistoryPage() {
	const navigate = useNavigate();
	const { showConfirm } = useConfirm();
	const { showToast } = useToast();
	const { allCharacters } = useCharacters();
	const [search, setSearch] = useState("");
	const [conversations, setConversations] = useState<ConversationMeta[]>([]);
	const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
	const [renamingId, setRenamingId] = useState<string | null>(null);
	const [renameValue, setRenameValue] = useState("");
	/**
	 * Character filter. `null` = show all. Stored as id-string so it survives
	 * a refresh of the character list (deleted characters keep their tag in
	 * old conversations and the filter just shows nothing for that bucket).
	 */
	const [characterFilter, setCharacterFilter] = useState<string | null>(null);
	// Guards against an older search response overwriting a newer one.
	const requestRef = useRef(0);

	const query = search.trim();

	const load = useCallback(async (q: string) => {
		const request = ++requestRef.current;
		try {
			const list = q
				? await historyService.searchConversations(q)
				: await historyService.getConversations();
			if (request !== requestRef.current) return;
			setConversations(list);
			setStatus("ready");
		} catch {
			if (request === requestRef.current) setStatus("error");
		}
	}, []);

	// Search runs in the backend over titles and message text; wait for a
	// pause in typing so each keystroke doesn't scan every conversation.
	useEffect(() => {
		const t = setTimeout(() => load(query), query ? 250 : 0);
		return () => clearTimeout(t);
	}, [query, load]);

	/**
	 * Build the filter rail from the current conversation set rather than from
	 * `allCharacters` — that way only characters with at least one saved chat
	 * appear. Falls back to the conversation's stored `character_name` if the
	 * character has been deleted since.
	 */
	const filterChips = useMemo(() => {
		const counts = new Map<string, { id: string; name: string; count: number }>();
		for (const c of conversations) {
			if (!c.character_id) continue;
			const known = allCharacters.find((ch) => ch.id === c.character_id);
			const name = known?.name ?? c.character_name ?? "Unknown";
			const entry = counts.get(c.character_id);
			if (entry) entry.count += 1;
			else counts.set(c.character_id, { id: c.character_id, name, count: 1 });
		}
		return [...counts.values()].sort((a, b) => b.count - a.count);
	}, [conversations, allCharacters]);

	const characterById = useMemo(
		() => new Map(allCharacters.map((c) => [c.id, c])),
		[allCharacters],
	);

	const handleDeleteOne = async (id: string, title: string) => {
		try {
			// Keep a copy so the delete can be undone from the toast.
			const backup = await historyService.loadConversation(id);
			await historyService.deleteConversation(id);
			vibrate(12);
			setConversations((prev) => prev.filter((c) => c.id !== id));
			showToast(
				`Deleted "${title}"`,
				"info",
				backup
					? {
							label: "Undo",
							onAction: () => {
								historyService
									.saveConversation(backup)
									.then(() => load(query))
									.catch(() => showToast("Couldn't restore the conversation", "error"));
							},
						}
					: undefined,
			);
		} catch {
			showToast("Couldn't delete the conversation", "error");
		}
	};

	const handleFinishRename = async () => {
		const id = renamingId;
		const title = renameValue.trim();
		setRenamingId(null);
		if (!id || !title) return;
		try {
			const conv = await historyService.loadConversation(id);
			if (!conv || conv.title === title) return;
			await historyService.saveConversation({ ...conv, title });
			setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
			showToast("Conversation renamed", "success");
		} catch {
			showToast("Couldn't rename the conversation", "error");
		}
	};

	const handleClearAll = async () => {
		const ok = await showConfirm({
			title: "Clear history",
			message: `Delete all ${conversations.length} conversations? This cannot be undone.`,
			confirmLabel: "Delete all",
			cancelLabel: "Cancel",
			danger: true,
		});
		if (!ok) return;
		try {
			await historyService.clearAllConversations();
			setConversations([]);
			showToast("Chat history cleared", "info");
		} catch {
			showToast("Couldn't clear chat history", "error");
		}
	};

	const filtered = characterFilter
		? conversations.filter((c) => c.character_id === characterFilter)
		: conversations;
	const groups = groupByDate(filtered);
	const isEmpty = status === "ready" && conversations.length === 0 && !query;

	return (
		<AppLayout
			title="Chat History"
			back="/chat"
			rightActions={
				conversations.length > 0 && !query ? (
					<ClearBtn type="button" onClick={handleClearAll}>
						Clear all
					</ClearBtn>
				) : undefined
			}
		>
			<Page>
				{!isEmpty && (
					<SearchBox>
						<SearchIconWrap>
							<Icon name="search" size={18} />
						</SearchIconWrap>
						<SearchInput
							type="search"
							placeholder="Search titles and messages..."
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							aria-label="Search conversations"
						/>
					</SearchBox>
				)}

				{filterChips.length > 1 && (
					<FilterRail role="group" aria-label="Filter by character">
						<FilterChip
							type="button"
							$active={characterFilter === null}
							$accent={tokens.colors.primary}
							aria-pressed={characterFilter === null}
							onClick={() => setCharacterFilter(null)}
						>
							All
						</FilterChip>
						{filterChips.map((chip) => {
							const c = characterById.get(chip.id);
							const accent = c ? accentOf(c) : tokens.colors.onSurfaceVariant;
							const isActive = characterFilter === chip.id;
							return (
								<FilterChip
									key={chip.id}
									type="button"
									$active={isActive}
									$accent={accent}
									aria-pressed={isActive}
									onClick={() => setCharacterFilter(isActive ? null : chip.id)}
								>
									{c && <Icon name={c.icon || "person"} size={12} color={accent} />}
									{chip.name} · {chip.count}
								</FilterChip>
							);
						})}
					</FilterRail>
				)}

				{status === "loading" ? (
					<ChatList aria-busy="true" aria-label="Loading conversations">
						{[0, 1, 2, 3].map((i) => (
							<SkeletonRow key={`sk-${i}`}>
								<SkeletonBlock $w="40px" $h="40px" />
								<SkeletonStack>
									<SkeletonBlock $w="60%" $h="14px" />
									<SkeletonBlock $w="40%" $h="11px" />
								</SkeletonStack>
							</SkeletonRow>
						))}
					</ChatList>
				) : status === "error" ? (
					<EmptyWrap>
						<EmptyState
							icon="error_outline"
							message="Couldn't load your chats"
							subtitle="Your conversations are still on this device. Try again."
						>
							<RetryBtn type="button" onClick={() => { setStatus("loading"); load(query); }}>
								<Icon name="refresh" size={16} />
								Try again
							</RetryBtn>
						</EmptyState>
					</EmptyWrap>
				) : isEmpty ? (
					<EmptyWrap>
						<EmptyState
							art="chats"
							message="No conversations yet"
							subtitle="Start a chat and it will be saved here automatically."
						>
							<StartChatBtn type="button" onClick={() => navigate("/chat", { state: { freshChat: true } })}>
								<Icon name="edit_square" size={16} />
								Start a chat
							</StartChatBtn>
						</EmptyState>
					</EmptyWrap>
				) : groups.length === 0 ? (
					<EmptyWrap>
						<EmptyState
							art="search"
							message="Nothing found"
							subtitle={query ? `No chat mentions "${query}".` : "No chats with this character."}
						/>
					</EmptyWrap>
				) : (
					groups.map(([label, items]) => (
						<section key={label} aria-label={label}>
							<GroupLabel>
								<GroupText>{label}</GroupText>
								<GroupLine />
							</GroupLabel>
							<ChatList>
								{items.map((entry) => {
									const ch = entry.character_id ? characterById.get(entry.character_id) : undefined;
									const accent = ch ? accentOf(ch) : undefined;
									const isRenaming = renamingId === entry.id;
									const body = (
										<>
											<ChatIcon $accent={accent}>
												<Icon
													name={ch?.icon || "chat_bubble"}
													size={18}
													color={accent || tokens.colors.onSurfaceVariant}
												/>
											</ChatIcon>
											<ChatInfo>
												{isRenaming ? (
													<RenameInput
														value={renameValue}
														maxLength={80}
														aria-label="Conversation title"
														onChange={(e) => setRenameValue(e.target.value)}
														onBlur={handleFinishRename}
														onKeyDown={(e) => {
															if (e.key === "Enter") e.currentTarget.blur();
															if (e.key === "Escape") setRenamingId(null);
														}}
														// biome-ignore lint/a11y/noAutofocus: the field appears in response to the user choosing Rename
														autoFocus
													/>
												) : (
													<ChatTitle>{entry.title}</ChatTitle>
												)}
												{entry.snippet && !isRenaming && <Snippet>{entry.snippet}</Snippet>}
												<ChatMeta>
													{entry.model_name} · {formatTime(entry.updated_at)}
												</ChatMeta>
											</ChatInfo>
										</>
									);
									return (
										<ChatItem key={entry.id}>
											{isRenaming ? (
												<RowButton as="div">{body}</RowButton>
											) : (
												<RowButton
													type="button"
													onClick={() => navigate("/chat", { state: { conversationId: entry.id } })}
												>
													{body}
												</RowButton>
											)}
											{!isRenaming && (
												<ActionGroup>
													<ActionBtn
														type="button"
														onClick={() => {
															setRenamingId(entry.id);
															setRenameValue(entry.title);
														}}
														aria-label={`Rename ${entry.title}`}
													>
														<Icon name="edit" size={18} color={tokens.colors.onSurfaceVariant} />
													</ActionBtn>
													<ActionBtn
														type="button"
														$danger
														onClick={() => handleDeleteOne(entry.id, entry.title)}
														aria-label={`Delete ${entry.title}`}
													>
														<Icon name="delete" size={18} color={tokens.colors.error} />
													</ActionBtn>
												</ActionGroup>
											)}
										</ChatItem>
									);
								})}
							</ChatList>
						</section>
					))
				)}
			</Page>
		</AppLayout>
	);
}
