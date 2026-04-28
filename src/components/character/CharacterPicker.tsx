import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { useCharacters } from "@/context/CharacterContext";
import type { Character } from "@/services/types";
import { tokens } from "@/theme/tokens";
import { accentOf, withAlpha } from "@/utils/characterAccent";
import { useEffect, useState } from "react";
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

const Sheet = styled.div`
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
`;

const Grabber = styled.div`
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: ${tokens.colors.outlineVariant};
  margin: 0 auto 0.5rem;
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

export function CharacterPicker({ open, onClose, onSelect }: Props) {
	const navigate = useNavigate();
	const { presets, customs, activeCharacter, setActiveCharacter, deleteCustom } = useCharacters();
	const { showConfirm } = useConfirm();
	const { showToast } = useToast();
	const [menuFor, setMenuFor] = useState<Character | null>(null);

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
			>
				<Grabber />
				<Header>
					<Title>Choose character</Title>
					<CloseBtn onClick={onClose} aria-label="Close">
						<Icon name="close" size={20} />
					</CloseBtn>
				</Header>
				<Scroll>
					<SectionLabel>Presets</SectionLabel>
					<Grid>{presets.map(renderCard)}</Grid>

					<SectionLabel>My characters</SectionLabel>
					<Grid>
						{customs.map(renderCard)}
						<CreateCard onClick={handleCreate} aria-label="Create custom character">
							<Icon name="add" size={20} />
							Create custom
						</CreateCard>
					</Grid>
				</Scroll>
			</Sheet>

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
							<MenuItem
								type="button"
								onClick={() => handleDuplicate(menuFor)}
							>
								<Icon name="content_copy" size={20} color={tokens.colors.onSurfaceVariant} />
								Use as template
							</MenuItem>
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
