import { Icon } from "@/components/ui/Icon";
import { alpha } from "@/theme/alpha";
import { tokens } from "@/theme/tokens";
import { useState } from "react";
import styled, { keyframes } from "styled-components";

/* A reasoning model writes out its thinking before the answer. That text is
   useful when you want to check the working, and noise the rest of the time,
   so it sits collapsed above the reply. While the model is still thinking the
   last couple of lines are shown, so the wait is visibly doing something. */

const shimmer = keyframes`
  0%, 100% { opacity: 0.55; }
  50% { opacity: 1; }
`;

const Box = styled.div`
  margin-bottom: 0.5rem;
  border-left: 2px solid ${alpha(tokens.colors.primary, "59")};
  padding-left: 0.625rem;
`;

const Toggle = styled.button<{ $live: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  min-height: 28px;
  padding: 0;
  background: none;
  border: none;
  cursor: pointer;
  font-size: ${tokens.typography.fontSize.xs};
  font-weight: ${tokens.typography.fontWeight.semibold};
  color: ${tokens.colors.onSurfaceVariant};
  animation: ${({ $live }) => ($live ? shimmer : "none")} 1.6s ease-in-out infinite;

  &:hover { color: ${tokens.colors.onSurface}; }
  &:focus-visible { outline: 2px solid ${tokens.colors.primary}; outline-offset: 2px; border-radius: 4px; }

  @media (hover: none) { min-height: 36px; }
`;

const Chevron = styled.span<{ $open: boolean }>`
  display: inline-flex;
  transition: transform ${tokens.transitions.fast};
  transform: rotate(${({ $open }) => ($open ? "180deg" : "0deg")});
`;

const Text = styled.div`
  margin-top: 0.25rem;
  font-size: ${tokens.typography.fontSize.sm};
  line-height: 1.55;
  color: ${tokens.colors.onSurfaceVariant};
  white-space: pre-wrap;
  overflow-wrap: anywhere;
`;

/** How much of the thinking is previewed while it is still being written. */
const PREVIEW_CHARS = 180;

interface ReasoningProps {
	text: string;
	/** True while the model is still thinking (no answer text yet). */
	live?: boolean;
}

export function Reasoning({ text, live = false }: ReasoningProps) {
	const [open, setOpen] = useState(false);
	const preview = text.length > PREVIEW_CHARS ? `…${text.slice(-PREVIEW_CHARS)}` : text;

	return (
		<Box>
			<Toggle type="button" $live={live} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
				<Icon name="psychology" size={14} />
				{live ? "Thinking…" : "Thought process"}
				<Chevron $open={open}>
					<Icon name="expand_more" size={14} />
				</Chevron>
			</Toggle>
			{open ? <Text>{text}</Text> : live ? <Text aria-hidden="true">{preview}</Text> : null}
		</Box>
	);
}

/* ── Composer extras ── */

export const ComposerTools = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  max-width: 52rem;
  margin: 0 auto;
  padding: 0.5rem 0.75rem 0;
`;

export const ThinkChip = styled.button<{ $on: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  min-height: 32px;
  padding: 0.25rem 0.75rem;
  border-radius: ${tokens.borderRadius.circle};
  border: 1px solid ${({ $on }) => ($on ? alpha(tokens.colors.primary, "99") : alpha(tokens.colors.outlineVariant, "80"))};
  background: ${({ $on }) => ($on ? alpha(tokens.colors.primary, "1f") : "transparent")};
  color: ${({ $on }) => ($on ? tokens.colors.primary : tokens.colors.onSurfaceVariant)};
  font-size: ${tokens.typography.fontSize.xs};
  font-weight: ${tokens.typography.fontWeight.semibold};
  cursor: pointer;
  transition: background ${tokens.transitions.fast}, color ${tokens.transitions.fast}, border-color ${tokens.transitions.fast};

  &:hover { color: ${({ $on }) => ($on ? tokens.colors.primary : tokens.colors.onSurface)}; }
  &:focus-visible { outline: 2px solid ${tokens.colors.primary}; outline-offset: 2px; }

  @media (hover: none) { min-height: 36px; }
`;

export const ToolHint = styled.span`
  font-size: ${tokens.typography.fontSize.xs};
  color: ${tokens.colors.onSurfaceVariant};
`;

/** Shown in place of the typing dots while a long conversation is re-read. */
export const ReadingLine = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding: 0.25rem 0;
  min-width: 11rem;
  font-size: ${tokens.typography.fontSize.xs};
  color: ${tokens.colors.onSurfaceVariant};
`;

export const ReadingTrack = styled.div`
  height: 3px;
  border-radius: 2px;
  background: ${tokens.colors.surfaceContainerHighest};
  overflow: hidden;
`;

export const ReadingFill = styled.div<{ $percent: number }>`
  height: 100%;
  width: ${({ $percent }) => $percent}%;
  background: ${tokens.colors.primary};
  transition: width 0.2s ease-out;
`;
