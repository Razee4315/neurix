import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { useAppContext } from "@/context/AppContext";
import { modelService } from "@/services";
import type { DownloadedModel } from "@/services/types";
import { alpha } from "@/theme/alpha";
import { tokens } from "@/theme/tokens";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled, { keyframes } from "styled-components";

/**
 * The model picker in the composer, next to the send button: the loaded
 * model's name, and a menu of every installed model that opens upwards.
 */

const Wrap = styled.div`
  position: relative;
  min-width: 0;
`;

const Trigger = styled.button<{ $open: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  max-width: 15rem;
  height: 32px;

  @media (max-width: 600px) { max-width: 8.5rem; }
  padding: 0 0.5rem 0 0.625rem;
  border: none;
  border-radius: ${tokens.borderRadius.lg};
  background: ${({ $open }) => ($open ? tokens.colors.surfaceContainerHighest : "transparent")};
  color: ${tokens.colors.onSurfaceVariant};
  font-family: ${tokens.typography.fontFamily.label};
  font-size: ${tokens.typography.fontSize.sm};
  cursor: pointer;
  transition: background ${tokens.transitions.fast}, color ${tokens.transitions.fast};

  &:hover { background: ${tokens.colors.surfaceContainerHighest}; color: ${tokens.colors.onSurface}; }
  &:disabled { cursor: default; opacity: 0.7; }

  > span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const menuIn = keyframes`
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
`;

const Menu = styled.div`
  position: absolute;
  right: 0;
  bottom: calc(100% + 8px);
  width: min(288px, calc(100vw - 1.5rem));
  max-height: 360px;
  overflow-y: auto;
  padding: 0.375rem;
  background: ${tokens.colors.surfaceContainer};
  border: 1px solid ${alpha(tokens.colors.outlineVariant, "cc")};
  border-radius: ${tokens.borderRadius.xl};
  box-shadow: 0 12px 32px rgb(0 0 0 / 0.35);
  z-index: ${tokens.zIndex.overlay};
  animation: ${menuIn} 0.14s ease-out;
`;

const MenuLabel = styled.div`
  padding: 0.375rem 0.625rem 0.25rem;
  font-size: ${tokens.typography.fontSize.xs};
  color: ${tokens.colors.onSurfaceVariant};
`;

const Option = styled.button`
  display: flex;
  align-items: center;
  gap: 0.625rem;
  width: 100%;
  padding: 0.5rem 0.625rem;
  border: none;
  border-radius: ${tokens.borderRadius.lg};
  background: transparent;
  color: ${tokens.colors.onSurface};
  text-align: left;
  cursor: pointer;

  &:hover { background: ${tokens.colors.surfaceContainerHighest}; }
  &:disabled { cursor: default; opacity: 0.6; }
`;

const OptionText = styled.span`
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
  line-height: 1.3;

  strong {
    font-size: ${tokens.typography.fontSize.sm};
    font-weight: ${tokens.typography.fontWeight.medium};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    font-size: ${tokens.typography.fontSize.xs};
    color: ${tokens.colors.onSurfaceVariant};
  }
`;

const Divider = styled.div`
  height: 1px;
  margin: 0.375rem 0.25rem;
  background: ${alpha(tokens.colors.outlineVariant, "99")};
`;

const Muted = styled.div`
  padding: 0.5rem 0.625rem;
  font-size: ${tokens.typography.fontSize.sm};
  color: ${tokens.colors.onSurfaceVariant};
`;

interface Props {
	/** The chat is busy (generating or loading): switching is not allowed. */
	disabled?: boolean;
}

export function ModelSelect({ disabled = false }: Props) {
	const navigate = useNavigate();
	const { showToast } = useToast();
	const { activeModel, activeModelId, loadModel } = useAppContext();
	const [open, setOpen] = useState(false);
	const [models, setModels] = useState<DownloadedModel[] | null>(null);
	const [loadingId, setLoadingId] = useState<string | null>(null);
	const wrapRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		modelService
			.getDownloadedModels()
			.then(setModels)
			.catch(() => setModels([]));
		const onPointer = (e: PointerEvent) => {
			if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") setOpen(false);
		};
		document.addEventListener("pointerdown", onPointer);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("pointerdown", onPointer);
			document.removeEventListener("keydown", onKey);
		};
	}, [open]);

	const choose = async (model: DownloadedModel) => {
		setOpen(false);
		if (model.id === activeModelId) return;
		setLoadingId(model.id);
		try {
			await loadModel(model.id);
		} catch (err) {
			showToast(err instanceof Error ? err.message : "Couldn't load that model", "error");
		} finally {
			setLoadingId(null);
		}
	};

	const label = loadingId
		? "Loading…"
		: (activeModel ?? "Choose a model");

	return (
		<Wrap ref={wrapRef}>
			<Trigger
				type="button"
				$open={open}
				disabled={disabled || loadingId !== null}
				onClick={() => setOpen((v) => !v)}
				aria-haspopup="listbox"
				aria-expanded={open}
				title="Model"
			>
				<span>{label}</span>
				<Icon name="expand_more" size={14} />
			</Trigger>
			{open && (
				<Menu role="listbox" aria-label="Installed models">
					<MenuLabel>Installed on this device</MenuLabel>
					{models === null && <Muted>Loading…</Muted>}
					{models?.length === 0 && <Muted>No models installed yet.</Muted>}
					{models?.map((model) => (
						<Option
							key={model.id}
							type="button"
							role="option"
							aria-selected={model.id === activeModelId}
							onClick={() => choose(model)}
						>
							<Icon name="model" size={16} color={tokens.colors.onSurfaceVariant} />
							<OptionText>
								<strong>{model.name}</strong>
								<small>
									{model.size_label}
									{model.tag ? ` · ${model.tag}` : ""}
								</small>
							</OptionText>
							{model.id === activeModelId && <Icon name="check" size={16} color={tokens.colors.primary} />}
						</Option>
					))}
					<Divider />
					<Option
						type="button"
						onClick={() => {
							setOpen(false);
							navigate("/store");
						}}
					>
						<Icon name="download" size={16} color={tokens.colors.onSurfaceVariant} />
						<OptionText>
							<strong>Get more models</strong>
						</OptionText>
					</Option>
				</Menu>
			)}
		</Wrap>
	);
}
