import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { Spinner } from "@/components/ui/LoadingOverlay";
import { useAppContext } from "@/context/AppContext";
import { useCharacters } from "@/context/CharacterContext";
import { modelService } from "@/services";
import type { Character, DownloadedModel } from "@/services/types";
import { alpha } from "@/theme/alpha";
import { tokens } from "@/theme/tokens";
import { accentOf } from "@/utils/characterAccent";
import { parseShared, shareCharacter } from "@/utils/characterShare";
import { shortId } from "@/utils/format";
import { vibrate } from "@/utils/platform";
import { useFocusTrap } from "@/utils/useFocusTrap";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled, { keyframes } from "styled-components";

interface Props {
	open: boolean;
	onClose: () => void;
	/** Also offer switching the loaded model (used from the chat header). */
	showModels?: boolean;
}

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const slideUp = keyframes`
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
`;

const Backdrop = styled.div<{ $top?: boolean }>`
  position: fixed;
  inset: 0;
  z-index: ${({ $top }) => ($top ? tokens.zIndex.sheetTop : tokens.zIndex.sheet)};
  background: ${tokens.colors.scrim};
  animation: ${fadeIn} 0.2s ease-out;
`;

const Sheet = styled.div<{ $dragY: number; $dragging: boolean }>`
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: ${tokens.zIndex.sheet};
  max-height: 85dvh;
  width: 100%;
  max-width: 40rem;
  margin: 0 auto;
  background: ${tokens.colors.surfaceContainer};
  border-top-left-radius: 1.25rem;
  border-top-right-radius: 1.25rem;
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
  background: ${alpha(tokens.colors.surfaceContainerHigh, "80")};
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

/* The card and its "more" button are siblings inside this shell: a button
   nested in a button is invalid markup and breaks keyboard and screen-reader
   use. */
const CardShell = styled.div`
  position: relative;
`;

const CardBase = styled.button<{ $active?: boolean; $accent: string }>`
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.875rem 0.875rem 1rem;
  border-radius: ${tokens.borderRadius.lg};
  border: 1.5px solid
    ${({ $active, $accent }) => ($active ? $accent : "transparent")};
  background: ${({ $active, $accent }) =>
		$active ? alpha($accent, "14") : tokens.colors.surfaceContainerHigh};
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
		$active ? $accent : alpha($accent, "20")};
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
  max-width: 28rem;
  margin: 0 auto;
  bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
  z-index: ${tokens.zIndex.sheetTop};
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

  &:active { transform: scale(0.97); background: ${alpha(tokens.colors.primary, "10")}; }
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
  max-width: 32rem;
  margin: 0 auto;
  z-index: ${tokens.zIndex.sheetTop};
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
  border: 1px solid ${alpha(tokens.colors.outlineVariant, "40")};
  border-radius: ${tokens.borderRadius.md};
  color: ${tokens.colors.onSurface};
  font-family: ${tokens.typography.fontFamily.mono};
  font-size: ${tokens.typography.fontSize.xs};
  resize: vertical;
  outline: none;

  &:focus { border-color: ${alpha(tokens.colors.primary, "80")}; }
`;

const ImportError = styled.div`
  font-size: ${tokens.typography.fontSize.xs};
  color: ${tokens.colors.error};
  padding: 0.375rem 0.5rem;
  background: ${alpha(tokens.colors.error, "12")};
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

/* ── Model switcher ── */

const ModelList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
`;

const ModelRow = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.75rem 0.875rem;
  border-radius: ${tokens.borderRadius.xl};
  border: 1.5px solid ${({ $active }) => ($active ? tokens.colors.primary : "transparent")};
  background: ${({ $active }) =>
		$active ? alpha(tokens.colors.primary, "14") : tokens.colors.surfaceContainerHigh};
  color: ${tokens.colors.onSurface};
  font-size: ${tokens.typography.fontSize.base};
  font-weight: ${tokens.typography.fontWeight.semibold};
  text-align: left;
  cursor: pointer;

  &:disabled { cursor: default; opacity: 0.7; }
  &:not(:disabled):active { transform: scale(0.98); }
`;

const ModelMeta = styled.span`
  margin-left: auto;
  font-size: ${tokens.typography.fontSize.xs};
  font-weight: ${tokens.typography.fontWeight.medium};
  color: ${tokens.colors.onSurfaceVariant};
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
`;

const TextLink = styled.button`
  align-self: flex-start;
  border: none;
  background: transparent;
  color: ${tokens.colors.primary};
  font-size: ${tokens.typography.fontSize.sm};
  font-weight: ${tokens.typography.fontWeight.semibold};
  padding: 0.5rem 0.25rem;
  cursor: pointer;
`;

export function CharacterPicker({ open, onClose, showModels = false }: Props) {
	const navigate = useNavigate();
	const { presets, customs, activeCharacter, setActiveCharacter, saveCustom, deleteCustom } = useCharacters();
	const { activeModelId, loadModel } = useAppContext();
	const { showConfirm } = useConfirm();
	const { showToast } = useToast();
	const [menuFor, setMenuFor] = useState<Character | null>(null);
	const [models, setModels] = useState<DownloadedModel[] | null>(null);
	const [loadingModelId, setLoadingModelId] = useState<string | null>(null);
	const sheetRef = useRef<HTMLDivElement>(null);
	const menuRef = useRef<HTMLDivElement>(null);
	const importRef = useRef<HTMLDivElement>(null);
	const [importOpen, setImportOpen] = useState(false);
	const [importText, setImportText] = useState("");
	const [importError, setImportError] = useState<string | null>(null);
	const [importing, setImporting] = useState(false);

	// Drag-to-dismiss. The live distance is kept in a ref so the document
	// listeners can read it without being re-attached on every move; the
	// state copy only drives the sheet's transform.
	const dragStartY = useRef<number | null>(null);
	const dragDistance = useRef(0);
	const [dragY, setDragY] = useState(0);
	const [dragging, setDragging] = useState(false);

	const onDragStart = (e: React.TouchEvent | React.MouseEvent) => {
		dragStartY.current = "touches" in e ? e.touches[0].clientY : e.clientY;
		dragDistance.current = 0;
		setDragging(true);
	};

	useEffect(() => {
		if (!dragging) return;
		const onMove = (e: TouchEvent | MouseEvent) => {
			if (dragStartY.current == null) return;
			const y = "touches" in e ? e.touches[0].clientY : e.clientY;
			dragDistance.current = Math.max(0, y - dragStartY.current);
			setDragY(dragDistance.current);
		};
		const onEnd = () => {
			dragStartY.current = null;
			setDragging(false);
			setDragY(0);
			// Dismiss if dragged more than ~120px or past 1/4 of the viewport.
			if (dragDistance.current > Math.min(120, window.innerHeight * 0.25)) onClose();
		};
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
	}, [dragging, onClose]);

	// Only the top-most layer traps focus.
	useFocusTrap(sheetRef, open && !menuFor && !importOpen);
	useFocusTrap(menuRef, open && !!menuFor);
	useFocusTrap(importRef, open && importOpen);

	useEffect(() => {
		if (!open || !showModels) return;
		let cancelled = false;
		modelService.getDownloadedModels()
			.then((list) => { if (!cancelled) setModels(list); })
			.catch(() => { if (!cancelled) setModels([]); });
		return () => { cancelled = true; };
	}, [open, showModels]);

	const handleSwitchModel = async (model: DownloadedModel) => {
		if (loadingModelId || model.id === activeModelId) return;
		setLoadingModelId(model.id);
		try {
			await loadModel(model.id);
			vibrate(10);
			showToast(`Now using ${model.name}`, "success");
		} catch (err) {
			showToast(err instanceof Error ? err.message : String(err), "error");
		} finally {
			setLoadingModelId(null);
		}
	};

	// Close on Escape.
	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				if (menuFor) setMenuFor(null);
				else if (importOpen) setImportOpen(false);
				else onClose();
			}
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [open, onClose, menuFor, importOpen]);

	// Pin the active character to the top of its section so it's always
	// visible without scrolling — most-used pattern in iOS settings, ChatGPT
	// model picker, etc.
	const sortedPresets = useMemo(() => {
		const active = presets.find((p) => p.id === activeCharacter?.id);
		if (!active) return presets;
		return [active, ...presets.filter((p) => p.id !== active.id)];
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

	const handleSelect = (c: Character) => {
		vibrate(5);
		// Close straight away; the write is quick and failure is reported.
		onClose();
		setActiveCharacter(c.id).catch(() => {
			showToast("Couldn't switch character", "error");
		});
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
			const newId = `custom:${shortId()}`;
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
		vibrate(5);
		setMenuFor(c);
	};

	const renderCard = (c: Character) => {
		const isActive = activeCharacter?.id === c.id;
		const accent = accentOf(c);
		return (
			<CardShell key={c.id}>
				<CardBase
					type="button"
					$active={isActive}
					$accent={accent}
					onClick={() => handleSelect(c)}
					onContextMenu={(e) => {
						e.preventDefault();
						setMenuFor(c);
					}}
					aria-pressed={isActive}
				>
					<IconBubble $active={isActive} $accent={accent}>
						<Icon name={c.icon || "person"} size={20} />
					</IconBubble>
					<div>
						<CardName>{c.name}</CardName>
						<CardDesc>{c.description || (c.is_preset ? "" : "Custom")}</CardDesc>
					</div>
					{isActive && <ActiveBadge $accent={accent}>Active</ActiveBadge>}
				</CardBase>
				<MoreBtn
					type="button"
					aria-label={`More actions for ${c.name}`}
					onClick={(e) => openMenu(e, c)}
				>
					<Icon name="more_vert" size={18} />
				</MoreBtn>
			</CardShell>
		);
	};

	return (
		<>
			<Backdrop onClick={onClose} />
			<Sheet
				ref={sheetRef}
				tabIndex={-1}
				role="dialog"
				aria-modal="true"
				aria-label={showModels ? "Character and model" : "Choose character"}
				onClick={(e) => e.stopPropagation()}
				$dragY={dragY}
				$dragging={dragging}
			>
				<GrabberZone onTouchStart={onDragStart} onMouseDown={onDragStart} aria-hidden="true">
					<Grabber />
				</GrabberZone>
				<Header>
					<Title>{showModels ? "Character & model" : "Choose character"}</Title>
					<CloseBtn type="button" onClick={onClose} aria-label="Close">
						<Icon name="close" size={20} />
					</CloseBtn>
				</Header>
				<Scroll>
					{showModels && (
						<>
							<SectionLabel>Model</SectionLabel>
							{models === null ? (
								<EmptyHint>Loading models…</EmptyHint>
							) : models.length === 0 ? (
								<EmptyHint>No models installed yet. Download one to start chatting.</EmptyHint>
							) : (
								<ModelList>
									{models.map((m) => {
										const isActive = m.id === activeModelId;
										return (
											<ModelRow
												key={m.id}
												type="button"
												$active={isActive}
												disabled={loadingModelId !== null}
												aria-pressed={isActive}
												onClick={() => handleSwitchModel(m)}
											>
												<Icon name="deployed_code" size={18} color={tokens.colors.primary} />
												{m.name}
												<ModelMeta>
													{m.id === loadingModelId ? (
														<>
															<Spinner $size={14} /> Loading…
														</>
													) : isActive ? (
														"Loaded"
													) : (
														m.size_label
													)}
												</ModelMeta>
											</ModelRow>
										);
									})}
								</ModelList>
							)}
							<TextLink
								type="button"
								onClick={() => {
									onClose();
									navigate("/store");
								}}
							>
								Browse more models
							</TextLink>
						</>
					)}
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
					<Backdrop $top onClick={() => !importing && setImportOpen(false)} />
					<ImportSheet
						ref={importRef}
						tabIndex={-1}
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
					<Backdrop onClick={() => setMenuFor(null)} $top />
					<MenuSheet
						ref={menuRef}
						tabIndex={-1}
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
