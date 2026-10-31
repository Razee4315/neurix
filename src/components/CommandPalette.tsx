import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { useAppContext } from "@/context/AppContext";
import { useCharacters } from "@/context/CharacterContext";
import { historyService, modelService } from "@/services";
import { alpha } from "@/theme/alpha";
import { THEMES } from "@/theme/themes";
import { tokens } from "@/theme/tokens";
import { rankMatches } from "@/utils/fuzzy";
import { isMac } from "@/utils/platform";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";

/**
 * Ctrl+K: go anywhere, open any chat, or change the model, character or theme
 * without leaving the keyboard. Also home to the other app-wide shortcuts.
 */

/** Fired on `window` to open the palette from a menu. */
export const OPEN_PALETTE = "neurix:open-palette";

const MOD = isMac() ? "⌘" : "Ctrl";
const RECENT_CHATS = 5;
const MATCHED_CHATS = 8;

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: ${tokens.zIndex.modal};
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 14vh 1rem 1rem;
  background: rgb(0 0 0 / 0.5);
`;

const Panel = styled.div`
  width: min(36rem, 100%);
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  background: ${tokens.colors.surfaceContainerHigh};
  border: 1px solid ${alpha(tokens.colors.outlineVariant, "cc")};
  border-radius: ${tokens.borderRadius.xl};
  overflow: hidden;
`;

const SearchRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.625rem;
  height: 48px;
  flex-shrink: 0;
  padding: 0 1rem;
  color: ${tokens.colors.onSurfaceVariant};
  border-bottom: 1px solid ${alpha(tokens.colors.outlineVariant, "99")};
`;

const SearchField = styled.input`
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: ${tokens.colors.onSurface};
  font-family: inherit;
  font-size: ${tokens.typography.fontSize.md};

  &::placeholder { color: ${tokens.colors.outline}; }
  &:focus-visible { outline: none; }
`;

const List = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0.25rem 0.375rem 0.375rem;
`;

const Group = styled.div`
  padding: 0.625rem 0.625rem 0.25rem;
  font-size: ${tokens.typography.fontSize.xs};
  font-weight: ${tokens.typography.fontWeight.medium};
  color: ${tokens.colors.onSurfaceVariant};
`;

const Option = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.625rem;
  width: 100%;
  height: 36px;
  padding: 0 0.625rem;
  border: none;
  border-radius: ${tokens.borderRadius.lg};
  background: ${({ $active }) => ($active ? tokens.colors.surfaceContainerHighest : "transparent")};
  color: ${tokens.colors.onSurface};
  font-family: inherit;
  font-size: ${tokens.typography.fontSize.base};
  text-align: left;
  cursor: pointer;

  svg { flex-shrink: 0; color: ${tokens.colors.onSurfaceVariant}; }
  > span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  kbd, small {
    flex-shrink: 0;
    font-family: inherit;
    font-size: ${tokens.typography.fontSize.xs};
    color: ${tokens.colors.onSurfaceVariant};
  }
`;

const Nothing = styled.div`
  padding: 1.5rem 1rem;
  text-align: center;
  font-size: ${tokens.typography.fontSize.sm};
  color: ${tokens.colors.onSurfaceVariant};
`;

const Footer = styled.div`
  display: flex;
  gap: 1rem;
  flex-shrink: 0;
  padding: 0.5rem 1rem;
  font-size: ${tokens.typography.fontSize.xs};
  color: ${tokens.colors.onSurfaceVariant};
  border-top: 1px solid ${alpha(tokens.colors.outlineVariant, "99")};

  @media (hover: none) { display: none; }
`;

interface Entry {
	id: string;
	group: string;
	label: string;
	icon: string;
	/** Right-hand note: a shortcut or the current state. */
	note?: string;
	run: () => void | Promise<void>;
}

export function CommandPalette() {
	const navigate = useNavigate();
	const { showToast } = useToast();
	const { activeModelId, settings, updateSettings, loadModel } = useAppContext();
	const { allCharacters, activeCharacter, setActiveCharacter } = useCharacters();
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [active, setActive] = useState(0);
	const [chatEntries, setChatEntries] = useState<Entry[]>([]);
	const [modelEntries, setModelEntries] = useState<Entry[]>([]);
	const returnFocus = useRef<HTMLElement | null>(null);
	const listRef = useRef<HTMLDivElement>(null);

	const newChat = useCallback(() => navigate("/chat", { state: { freshChat: true } }), [navigate]);

	const show = useCallback(() => {
		returnFocus.current = document.activeElement as HTMLElement | null;
		setQuery("");
		setActive(0);
		setOpen(true);
	}, []);

	const close = useCallback(() => {
		setOpen(false);
		returnFocus.current?.focus();
	}, []);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
			const key = e.key.toLowerCase();
			if (key === "k") {
				e.preventDefault();
				setOpen((was) => {
					if (was) returnFocus.current?.focus();
					else {
						returnFocus.current = document.activeElement as HTMLElement | null;
						setQuery("");
						setActive(0);
					}
					return !was;
				});
			} else if (key === "n" && !e.shiftKey) {
				e.preventDefault();
				newChat();
			} else if (key === "f" && e.shiftKey) {
				e.preventDefault();
				navigate("/chat/history");
			}
		};
		document.addEventListener("keydown", onKey);
		window.addEventListener(OPEN_PALETTE, show);
		return () => {
			document.removeEventListener("keydown", onKey);
			window.removeEventListener(OPEN_PALETTE, show);
		};
	}, [navigate, newChat, show]);

	// Read at startup and on every open, so the first open is already filled in.
	// Chats and models load apart: neither waits for the other.
	// biome-ignore lint/correctness/useExhaustiveDependencies: open only asks for a fresh read
	useEffect(() => {
		let alive = true;
		historyService
			.getConversations()
			.catch(() => [])
			.then((list) => {
				if (!alive) return;
				setChatEntries(
					list.map((chat) => ({
						id: `chat:${chat.id}`,
						group: "Chats",
						label: chat.title || "Untitled chat",
						icon: "chat_bubble",
						run: () => navigate("/chat", { state: { conversationId: chat.id } }),
					})),
				);
			});
		modelService
			.getDownloadedModels()
			.catch(() => [])
			.then((list) => {
				if (!alive) return;
				setModelEntries(
					list.map((model) => ({
						id: `model:${model.id}`,
						group: "Models",
						label: model.name,
						icon: "deployed_code",
						note: model.id === activeModelId ? "In use" : undefined,
						run: async () => {
							try {
								await loadModel(model.id);
								showToast(`Now using ${model.name}`, "success");
							} catch {
								showToast(`Couldn't load ${model.name}`, "error");
							}
						},
					})),
				);
			});
		return () => {
			alive = false;
		};
	}, [open, activeModelId, loadModel, navigate, showToast]);

	const entries = useMemo<Entry[]>(() => {
		const go = (id: string, label: string, icon: string, path: string, note?: string): Entry => ({
			id,
			group: "Go to",
			label,
			icon,
			note,
			run: () => navigate(path),
		});
		return [
			{ id: "new", group: "Go to", label: "New chat", icon: "add", note: `${MOD} N`, run: newChat },
			go("history", "Search chats", "search", "/chat/history", `${MOD} Shift F`),
			go("models", "Models", "deployed_code", "/models"),
			go("store", "Model Store", "storefront", "/store"),
			go("connectors", "Connectors", "plug", "/connectors"),
			go("settings", "Settings", "settings", "/settings", `${MOD} ,`),
			go("friend", "New friend", "diversity_3", "/friend/new"),
			go("character", "New character", "person", "/character/new"),
			...allCharacters.map((character) => ({
				id: `character:${character.id}`,
				group: "Characters and friends",
				label: character.name,
				icon: character.icon || "person",
				note: character.id === activeCharacter?.id ? "Active" : undefined,
				run: () => setActiveCharacter(character.id),
			})),
			...THEMES.map((theme) => ({
				id: `theme:${theme.id}`,
				group: "Themes",
				label: theme.name,
				icon: "palette",
				note: theme.id === settings?.theme ? "Active" : undefined,
				run: () => updateSettings({ theme: theme.id }).then(() => undefined),
			})),
			...chatEntries,
			...modelEntries,
		];
	}, [allCharacters, activeCharacter?.id, chatEntries, modelEntries, navigate, newChat, setActiveCharacter, settings?.theme, updateSettings]);

	const shown = useMemo(() => {
		if (!query.trim()) {
			const chats = entries.filter((e) => e.group === "Chats").slice(0, RECENT_CHATS);
			return [...chats, ...entries.filter((e) => e.group === "Go to")];
		}
		const ranked = rankMatches(query, entries, (e) => e.label);
		const chats = ranked.filter((e) => e.group === "Chats").slice(0, MATCHED_CHATS);
		return [...ranked.filter((e) => e.group !== "Chats"), ...chats];
	}, [entries, query]);

	const pick = (entry: Entry | undefined) => {
		if (!entry) return;
		setOpen(false);
		void entry.run();
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: runs when the highlighted row changes
	useEffect(() => {
		listRef.current?.querySelector("[aria-selected='true']")?.scrollIntoView({ block: "nearest" });
	}, [active, shown]);

	if (!open) return null;

	const onKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Escape") {
			e.preventDefault();
			close();
		} else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
			e.preventDefault();
			const by = e.key === "ArrowDown" ? 1 : -1;
			setActive((i) => (shown.length === 0 ? 0 : (i + by + shown.length) % shown.length));
		} else if (e.key === "Enter") {
			e.preventDefault();
			pick(shown[active]);
		}
	};

	return (
		<Backdrop onMouseDown={close}>
			<Panel role="dialog" aria-label="Command palette" onMouseDown={(e) => e.stopPropagation()}>
				<SearchRow>
					<Icon name="search" size={18} />
					<SearchField
						autoFocus
						value={query}
						placeholder="Search actions, chats, models and themes"
						aria-label="Search actions, chats, models and themes"
						role="combobox"
						aria-expanded
						aria-controls="palette-list"
						aria-activedescendant={shown[active] ? `palette-${shown[active].id}` : undefined}
						autoComplete="off"
						spellCheck={false}
						onChange={(e) => {
							setQuery(e.target.value);
							setActive(0);
						}}
						onKeyDown={onKeyDown}
					/>
				</SearchRow>
				<List id="palette-list" ref={listRef} role="listbox" aria-label="Results">
					{shown.length === 0 && <Nothing>Nothing matches that</Nothing>}
					{shown.map((entry, i) => (
						<div key={entry.id}>
							{entry.group !== shown[i - 1]?.group && <Group>{entry.group}</Group>}
							<Option
								id={`palette-${entry.id}`}
								type="button"
								role="option"
								aria-selected={i === active}
								$active={i === active}
								onMouseMove={() => setActive(i)}
								onClick={() => pick(entry)}
							>
								<Icon name={entry.icon} size={16} />
								<span>{entry.label}</span>
								{entry.note && <small>{entry.note}</small>}
							</Option>
						</div>
					))}
				</List>
				<Footer>
					<span>↑ ↓ to move</span>
					<span>Enter to open</span>
					<span>Esc to close</span>
				</Footer>
			</Panel>
		</Backdrop>
	);
}
