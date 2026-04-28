import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { useCharacters } from "@/context/CharacterContext";
import type { Character } from "@/services/types";
import { tokens } from "@/theme/tokens";
import { accentOf, withAlpha } from "@/utils/characterAccent";
import { parseShared, shareCharacter } from "@/utils/characterShare";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled, { keyframes } from "styled-components";

interface Props {
	open: boolean;
	onClose: () => void;
	/** Called when the user picks a character. Defaults to setting it active. */
	onSelect?: (character: Character) => void;
}

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const slideUp = keyframes`
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
`;

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 900;
  background: rgba(0, 0, 0, 0.55);
  animation: ${fadeIn} 0.2s ease-out;
`;

const Sheet = styled.div<{ $dragY: number; $dragging: boolean }>`
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 901;
  max-height: 85dvh;
  background: ${tokens.colors.surfaceContainer};
  border-top-left-radius: ${tokens.borderRadius.xl};
  border-top-right-radius: ${tokens.borderRadius.xl};
  padding: 0.75rem 1rem
    calc(1rem + env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
  animation: ${slideUp} 0.25s ease-out;
  transform: translateY(${({ $dragY }) => $dragY}px);
  transition: ${({ $dragging }) =>
		$dragging ? "none" : `transform ${tokens.transitions.fast}`};
  touch-action: pan-y;
`;

/* The grabber zone is the entire top strip — bigger touch target than the
   tiny pill that ships in most apps, so users actually hit it. */
const GrabberZone = styled.div`
  padding: 0.25rem 0 0.5rem;
  cursor: grab;
  -webkit-tap-highlight-color: transparent;

  &:active { cursor: grabbing; }
`;

const Grabber = styled.div`
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: ${tokens.colors.outlineVariant};
  margin: 0 auto;
`;

/* ── Empty state for "My characters" ── */

const EmptyHint = styled.div`
  grid-column: 1 / -1;
  padding: 0.875rem;
  border-radius: ${tokens.borderRadius.lg};
  background: ${tokens.colors.surfaceContainerHigh}80;
  color: ${tokens.colors.onSurfaceVariant};
  font-size: ${tokens.typography.fontSize.xs};
  line-height: ${tokens.typography.lineHeight.relaxed};
  text-align: center;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.25rem 0 0.75rem;
`;

const Title = styled.h2`
  font-family: ${tokens.typography.fontFamily.headline};
  font-size: ${tokens.typography.fontSize.lg};
  font-weight: ${tokens.typography.fontWeight.bold};
  color: ${tokens.colors.onSurface};
`;

const CloseBtn = styled.button`
  border: none;
  background: transparent;
  width: 36px;
  height: 36px;
  border-radius: ${tokens.borderRadius.circle};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: ${tokens.colors.onSurfaceVariant};
  -webkit-tap-highlight-color: transparent;

  &:active { transform: scale(0.92); background: ${tokens.colors.surfaceContainerHigh}; }
`;

const Scroll = styled.div`
  overflow-y: auto;
  scrollbar-width: none;
  &::-webkit-scrollbar { width: 0; }
`;

const SectionLabel = styled.div`
  font-family: ${tokens.typography.fontFamily.label};
  font-size: ${tokens.typography.fontSize.xs};
  font-weight: ${tokens.typography.fontWeight.bold};
  color: ${tokens.colors.onSurfaceVariant};
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 0.75rem 0.25rem 0.5rem;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.625rem;
`;

const CardBase = styled.button<{ $active?: boolean; $accent: string }>`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.875rem 0.875rem 1rem;
  border-radius: ${tokens.borderRadius.lg};
  border: 1.5px solid
    ${({ $active, $accent }) => ($active ? $accent : "transparent")};
  background: ${({ $active, $accent }) =>
		$active ? withAlpha($accent, "14") : tokens.colors.surfaceContainerHigh};
  text-align: left;
  cursor: pointer;
  transition: transform ${tokens.transitions.fast}, background ${tokens.transitions.fast};
  -webkit-tap-highlight-color: transparent;
  min-height: 96px;

  &:active { transform: scale(0.97); }
`;

const IconBubble = styled.div<{ $active?: boolean; $accent: string }>`
  width: 36px;
  height: 36px;
  border-radius: ${tokens.borderRadius.md};
  background: ${({ $active, $accent }) =>
		$active ? $accent : withAlpha($accent, "20")};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ $active, $accent }) =>
		$active ? tokens.colors.surface : $accent};
`;

const CardName = styled.div`
  font-family: ${tokens.typography.fontFamily.headline};
  font-size: ${tokens.typography.fontSize.base};
  font-weight: ${tokens.typography.fontWeight.bold};
  color: ${tokens.colors.onSurface};
`;

const CardDesc = styled.div`
  font-size: ${tokens.typography.fontSize.xs};
  color: ${tokens.colors.onSurfaceVariant};
  line-height: ${tokens.typography.lineHeight.snug};
`;

const MoreBtn = styled.button`
  position: absolute;
  top: 0.375rem;
  right: 0.375rem;
  width: 28px;
  height: 28px;
  border-radius: ${tokens.borderRadius.circle};
  border: none;
  background: transparent;
  color: ${tokens.colors.onSurfaceVariant};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background ${tokens.transitions.fast};

  &:hover { background: ${tokens.colors.surfaceContainerHighest}; }
  &:active { transform: scale(0.9); }
`;

const ActiveBadge = styled.span<{ $accent: string }>`
  position: absolute;
  bottom: 0.5rem;
  right: 0.625rem;
  font-size: 10px;
  font-weight: ${tokens.typography.fontWeight.bold};
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: ${({ $accent }) => $accent};
`;

/* ── Action menu (secondary sheet) ── */

const MenuSheet = styled.div`
  position: fixed;
  left: 1rem;
  right: 1rem;
  bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
  z-index: 950;
  background: ${tokens.colors.surfaceContainerHigh};
  border-radius: ${tokens.borderRadius.xl};
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  animation: ${slideUp} 0.2s ease-out;
  box-shadow: ${tokens.shadows.elevated};
`;

const MenuItem = styled.button<{ $danger?: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 0.75rem;
  background: transparent;
  border: none;
  border-radius: ${tokens.borderRadius.md};
  color: ${({ $danger }) => ($danger ? tokens.colors.error : tokens.colors.onSurface)};
  font-size: ${tokens.typography.fontSize.base};
  font-family: ${tokens.typography.fontFamily.body};
  text-align: left;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;

  &:hover { background: ${tokens.colors.surfaceContainerHighest}; }
  &:active { transform: scale(0.98); }
`;

const MenuHeader = styled.div`
  padding: 0.5rem 0.75rem 0.25rem;
  font-size: ${tokens.typography.fontSize.xs};
  color: ${tokens.colors.onSurfaceVariant};
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: ${tokens.typography.fontWeight.bold};
`;

const CreateCard = styled.button`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.875rem;
  min-height: 96px;
  border-radius: ${tokens.borderRadius.lg};
  border: 1.5px dashed ${tokens.colors.outlineVariant};
  background: transparent;
  cursor: pointer;
  color: ${tokens.colors.primary};
  font-size: ${tokens.typography.fontSize.sm};
  font-weight: ${tokens.typography.fontWeight.bold};
  -webkit-tap-highlight-color: transparent;
  transition: background ${tokens.transitions.fast}, transform ${tokens.transitions.fast};

  &:active { transform: scale(0.97); background: ${tokens.colors.primary}10; }
`;

const ImportCard = styled(CreateCard)`
  color: ${tokens.colors.tertiary};
`;

/* ── Import modal — paste-JSON UX is faster than a file picker on mobile,
   works on every platform, and avoids any file-system permission story. */

const ImportSheet = styled.div`
  position: fixed;
  left: 1rem;
  right: 1rem;
  top: 50%;
  transform: translateY(-50%);
  z-index: 950;
  background: ${tokens.colors.surfaceContainerHigh};
  border-radius: ${tokens.borderRadius.xl};
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-height: 80dvh;
  box-shadow: ${tokens.shadows.elevated};
`;

const ImportTitle = styled.h3`
  font-family: ${tokens.typography.fontFamily.headline};
  font-size: ${tokens.typography.fontSize.lg};
  font-weight: ${tokens.typography.fontWeight.bold};
  color: ${tokens.colors.onSurface};
  margin: 0;
`;

const ImportHint = styled.p`
  font-size: ${tokens.typography.fontSize.xs};
  color: ${tokens.colors.onSurfaceVariant};
  margin: 0;
  line-height: ${tokens.typography.lineHeight.relaxed};
`;

const ImportTextArea = styled.textarea`
  width: 100%;
  min-height: 140px;
  padding: 0.75rem;
  background: ${tokens.colors.surfaceContainer};
  border: 1px solid ${tokens.colors.outlineVariant}40;
  border-radius: ${tokens.borderRadius.md};
  color: ${tokens.colors.onSurface};
  font-family: ${tokens.typography.fontFamily.mono};
  font-size: ${tokens.typography.fontSize.xs};
  resize: vertical;
  outline: none;

  &:focus { border-color: ${tokens.colors.primary}80; }
`;

const ImportError = styled.div`
  font-size: ${tokens.typography.fontSize.xs};
  color: ${tokens.colors.error};
  padding: 0.375rem 0.5rem;
  background: ${tokens.colors.error}12;
  border-radius: ${tokens.borderRadius.md};
`;

const ImportActions = styled.div`
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
`;

const SecondaryBtn = styled.button`
  padding: 0.625rem 1rem;
  border-radius: ${tokens.borderRadius.lg};
  background: transparent;
  color: ${tokens.colors.onSurface};
  border: 1px solid ${tokens.colors.outlineVariant};
  font-size: ${tokens.typography.fontSize.sm};
  font-weight: ${tokens.typography.fontWeight.medium};
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;

  &:active { transform: scale(0.96); }
`;

const PrimaryBtn = styled.button`
  padding: 0.625rem 1rem;
  border-radius: ${tokens.borderRadius.lg};
  background: ${tokens.colors.primary};
  color: ${tokens.colors.onPrimary};
  border: none;
  font-size: ${tokens.typography.fontSize.sm};
  font-weight: ${tokens.typography.fontWeight.bold};
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;

  &:disabled { opacity: 0.5; cursor: not-allowed; }
  &:not(:disabled):active { transform: scale(0.96); }
`;

export function CharacterPicker({ open, onClose, onSelect }: Props) {
	const navigate = useNavigate();
	const { presets, customs, activeCharacter, setActiveCharacter, saveCustom, deleteCustom } = useCharacters();
	const { showConfirm } = useConfirm();
	const { showToast } = useToast();
	const [menuFor, setMenuFor] = useState<Character | null>(null);
	const [importOpen, setImportOpen] = useState(false);
	const [importText, setImportText] = useState("");
	const [importError, setImportError] = useState<string | null>(null);
	const [importing, setImporting] = useState(false);

	// Drag-to-dismiss state. Tracking these in refs (not state) avoids a
	// re-render on every touchmove tick.
	const dragStartY = useRef<number | null>(null);
	const [dragY, setDragY] = useState(0);
	const [dragging, setDragging] = useState(false);

	const onDragStart = (e: React.TouchEvent | React.MouseEvent) => {
		const y = "touches" in e ? e.touches[0].clientY : e.clientY;
		dragStartY.current = y;
		setDragging(true);
	};

	const onDragMove = (e: TouchEvent | MouseEvent) => {
		if (dragStartY.current == null) return;
		const y = "touches" in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
		const delta = Math.max(0, y - dragStartY.current);
		setDragY(delta);
	};

	const onDragEnd = () => {
		const start = dragStartY.current;
		dragStartY.current = null;
		setDragging(false);
		// Dismiss if dragged more than ~120px or past 1/4 of the viewport.
		const threshold = Math.min(120, window.innerHeight * 0.25);
		if (start != null && dragY > threshold) {
			onClose();
		}
		setDragY(0);
	};

	useEffect(() => {
		if (!dragging) return;
		const onMove = (e: TouchEvent | MouseEvent) => onDragMove(e);
		const onEnd = () => onDragEnd();
		document.addEventListener("touchmove", onMove, { passive: true });
		document.addEventListener("touchend", onEnd);
		document.addEventListener("touchcancel", onEnd);
		document.addEventListener("mousemove", onMove);
		document.addEventListener("mouseup", onEnd);
		return () => {
			document.removeEventListener("touchmove", onMove);
			document.removeEventListener("touchend", onEnd);
			document.removeEventListener("touchcancel", onEnd);
			document.removeEventListener("mousemove", onMove);
			document.removeEventListener("mouseup", onEnd);
		};
		// onDragMove/onDragEnd close over dragY via state, but we always need
		// the live values; the closure is created fresh each render so this
		// is fine.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [dragging, dragY]);

	// Close on Escape.
	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				if (menuFor) setMenuFor(null);
				else onClose();
			}
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [open, onClose, menuFor]);

	// Pin the active character to the top of its section so it's always
	// visible without scrolling — most-used pattern in iOS settings, ChatGPT
	// model picker, etc.
	const sortedPresets = useMemo(() => {
		if (!activeCharacter || !presets.some((p) => p.id === activeCharacter.id)) return presets;
		const active = presets.find((p) => p.id === activeCharacter.id)!;
		return [active, ...presets.filter((p) => p.id !== activeCharacter.id)];
	}, [presets, activeCharacter]);

	/**
	 * Sort customs by:
	 *   1. active first (always pinned to top, so the user can spot the
	 *      current persona without scrolling)
	 *   2. then by `last_used_at` desc (recently-used pattern)
	 *   3. characters never used fall to the bottom in created order
	 */
	const sortedCustoms = useMemo(() => {
		const others = customs.filter((c) => c.id !== activeCharacter?.id);
		const active = customs.find((c) => c.id === activeCharacter?.id);
		const sorted = [...others].sort((a, b) => {
			const aT = a.last_used_at ?? "";
			const bT = b.last_used_at ?? "";
			if (aT && bT) return bT.localeCompare(aT);
			if (aT) return -1;
			if (bT) return 1;
			return 0;
		});
		return active ? [active, ...sorted] : sorted;
	}, [customs, activeCharacter]);

	if (!open) return null;

	const handleSelect = async (c: Character) => {
		if (navigator.vibrate) navigator.vibrate(5);
		if (onSelect) {
			onSelect(c);
		} else {
			await setActiveCharacter(c.id);
		}
		onClose();
	};

	const handleCreate = () => {
		onClose();
		navigate("/character/new");
	};

	const handleEditCustom = (c: Character) => {
		onClose();
		navigate(`/character/edit?id=${encodeURIComponent(c.id)}`);
	};

	const handleDuplicate = (c: Character) => {
		onClose();
		navigate(`/character/new?from=${encodeURIComponent(c.id)}`);
	};

	const handleShare = async (c: Character) => {
		setMenuFor(null);
		try {
			const result = await shareCharacter(c);
			showToast(
				result === "shared"
					? "Character shared"
					: "Character JSON copied — paste anywhere to share",
				"success",
			);
		} catch (err) {
			// AbortError = user cancelled the share sheet; stay quiet.
			if (err instanceof Error && err.name !== "AbortError") {
				showToast("Couldn't share character", "error");
			}
		}
	};

	const handleImport = async () => {
		if (importing) return;
		const result = parseShared(importText);
		if (!result.ok) {
			setImportError(result.error);
			return;
		}
		setImporting(true);
		setImportError(null);
		try {
			const newId = `custom:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
			const character: Character = {
				...result.draft,
				id: newId,
				is_preset: false,
				created_at: new Date().toISOString(),
			};
			await saveCustom(character);
			showToast(`Imported "${character.name}"`, "success");
			setImportOpen(false);
			setImportText("");
		} catch {
			setImportError("Couldn't save the character. Please try again.");
		} finally {
			setImporting(false);
		}
	};

	const handleDelete = async (c: Character) => {
		setMenuFor(null);
		const ok = await showConfirm({
			title: "Delete character",
			message: `Delete "${c.name}"? This can't be undone.`,
			confirmLabel: "Delete",
			cancelLabel: "Cancel",
			danger: true,
		});
		if (!ok) return;
		try {
			await deleteCustom(c.id);
			showToast("Character deleted", "info");
		} catch {
			showToast("Couldn't delete character", "error");
		}
	};

	const openMenu = (e: React.MouseEvent, c: Character) => {
		e.stopPropagation();
		if (navigator.vibrate) navigator.vibrate(5);
		setMenuFor(c);
	};

	const renderCard = (c: Character) => {
		const isActive = activeCharacter?.id === c.id;
		const accent = accentOf(c);
		return (
			<CardBase
				key={c.id}
				$active={isActive}
				$accent={accent}
				onClick={() => handleSelect(c)}
				onContextMenu={(e) => {
					e.preventDefault();
					setMenuFor(c);
				}}
				aria-pressed={isActive}
			>
				<MoreBtn
					type="button"
					aria-label={`More actions for ${c.name}`}
					onClick={(e) => openMenu(e, c)}
				>
					<Icon name="more_vert" size={18} />
				</MoreBtn>
				<IconBubble $active={isActive} $accent={accent}>
					<Icon name={c.icon || "person"} size={20} />
				</IconBubble>
				<div>
					<CardName>{c.name}</CardName>
					<CardDesc>{c.description || (c.is_preset ? "" : "Custom")}</CardDesc>
				</div>
				{isActive && <ActiveBadge $accent={accent}>Active</ActiveBadge>}
			</CardBase>
		);
	};

	return (
		<>
			<Backdrop onClick={onClose} />
			<Sheet
				role="dialog"
				aria-modal="true"
				aria-label="Choose character"
				onClick={(e) => e.stopPropagation()}
				$dragY={dragY}
				$dragging={dragging}
			>
				<GrabberZone
					onTouchStart={onDragStart}
					onMouseDown={onDragStart}
					aria-label="Drag down to close"
				>
					<Grabber />
				</GrabberZone>
				<Header>
					<Title>Choose character</Title>
					<CloseBtn onClick={onClose} aria-label="Close">
						<Icon name="close" size={20} />
					</CloseBtn>
				</Header>
				<Scroll>
					<SectionLabel>Presets</SectionLabel>
					<Grid>{sortedPresets.map(renderCard)}</Grid>

					<SectionLabel>My characters</SectionLabel>
					<Grid>
						{customs.length === 0 && (
							<EmptyHint>
								Create characters with your own tone, instructions, or
								expertise. They'll show up here.
							</EmptyHint>
						)}
						{sortedCustoms.map(renderCard)}
						<CreateCard onClick={handleCreate} aria-label="Create custom character">
							<Icon name="add" size={20} />
							Create custom
						</CreateCard>
						<ImportCard
							onClick={() => {
								setImportText("");
								setImportError(null);
								setImportOpen(true);
							}}
							aria-label="Import character from JSON"
						>
							<Icon name="download" size={20} />
							Import
						</ImportCard>
					</Grid>
				</Scroll>
			</Sheet>

			{importOpen && (
				<>
					<Backdrop
						onClick={() => !importing && setImportOpen(false)}
						style={{ zIndex: 940 }}
					/>
					<ImportSheet
						role="dialog"
						aria-modal="true"
						aria-label="Import character"
						onClick={(e) => e.stopPropagation()}
					>
						<ImportTitle>Import character</ImportTitle>
						<ImportHint>
							Paste the JSON a friend shared. We'll validate it and add it
							to your characters.
						</ImportHint>
						<ImportTextArea
							value={importText}
							onChange={(e) => {
								setImportText(e.target.value);
								if (importError) setImportError(null);
							}}
							placeholder='{"kind":"neurix.character", …}'
							autoFocus
							spellCheck={false}
							aria-label="Character JSON"
						/>
						{importError && <ImportError>{importError}</ImportError>}
						<ImportActions>
							<SecondaryBtn
								type="button"
								onClick={() => setImportOpen(false)}
								disabled={importing}
							>
								Cancel
							</SecondaryBtn>
							<PrimaryBtn
								type="button"
								onClick={handleImport}
								disabled={importing || importText.trim().length === 0}
							>
								{importing ? "Importing…" : "Import"}
							</PrimaryBtn>
						</ImportActions>
					</ImportSheet>
				</>
			)}

			{menuFor && (
				<>
					<Backdrop onClick={() => setMenuFor(null)} style={{ zIndex: 940 }} />
					<MenuSheet
						role="dialog"
						aria-modal="true"
						aria-label={`Actions for ${menuFor.name}`}
						onClick={(e) => e.stopPropagation()}
					>
						<MenuHeader>{menuFor.name}</MenuHeader>
						{menuFor.is_preset ? (
							<>
								<MenuItem
									type="button"
									onClick={() => handleDuplicate(menuFor)}
								>
									<Icon name="content_copy" size={20} color={tokens.colors.onSurfaceVariant} />
									Use as template
								</MenuItem>
								<MenuItem
									type="button"
									onClick={() => handleShare(menuFor)}
								>
									<Icon name="ios_share" size={20} color={tokens.colors.onSurfaceVariant} />
									Share
								</MenuItem>
							</>
						) : (
							<>
								<MenuItem
									type="button"
									onClick={() => handleEditCustom(menuFor)}
								>
									<Icon name="edit" size={20} color={tokens.colors.onSurfaceVariant} />
									Edit
								</MenuItem>
								<MenuItem
									type="button"
									onClick={() => handleDuplicate(menuFor)}
								>
									<Icon name="content_copy" size={20} color={tokens.colors.onSurfaceVariant} />
									Duplicate
								</MenuItem>
								<MenuItem
									type="button"
									onClick={() => handleShare(menuFor)}
								>
									<Icon name="ios_share" size={20} color={tokens.colors.onSurfaceVariant} />
									Share
								</MenuItem>
								<MenuItem
									type="button"
									$danger
									onClick={() => handleDelete(menuFor)}
								>
									<Icon name="delete" size={20} color={tokens.colors.error} />
									Delete
								</MenuItem>
							</>
						)}
					</MenuSheet>
				</>
			)}
		</>
	);
}
