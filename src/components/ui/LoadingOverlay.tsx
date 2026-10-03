import { tokens } from "@/theme/tokens";
import { alpha } from "@/theme/alpha";
import type { ReactNode } from "react";
import styled, { keyframes } from "styled-components";

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const pulse = keyframes`
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: ${tokens.zIndex.overlay};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.25rem;
  background: ${alpha(tokens.colors.background, "f2")};
  padding:
    calc(env(safe-area-inset-top, 0px) + 2rem)
    calc(env(safe-area-inset-right, 0px) + 2rem)
    calc(env(safe-area-inset-bottom, 0px) + 2rem)
    calc(env(safe-area-inset-left, 0px) + 2rem);
`;

export const Spinner = styled.div<{ $size?: number }>`
  width: ${({ $size = 48 }) => $size}px;
  height: ${({ $size = 48 }) => $size}px;
  border: 3px solid ${tokens.colors.surfaceContainerHighest};
  border-top-color: ${tokens.colors.primary};
  border-radius: 50%;
  animation: ${spin} 0.8s linear infinite;
`;

const Title = styled.h2`
  font-family: ${tokens.typography.fontFamily.headline};
  font-size: ${tokens.typography.fontSize.xl};
  font-weight: ${tokens.typography.fontWeight.bold};
  color: ${tokens.colors.onSurface};
  text-align: center;
`;

const Subtitle = styled.p<{ $pulse: boolean }>`
  font-size: ${tokens.typography.fontSize.base};
  color: ${tokens.colors.onSurfaceVariant};
  text-align: center;
  max-width: 320px;
  line-height: ${tokens.typography.lineHeight.relaxed};
  animation: ${({ $pulse }) => ($pulse ? pulse : "none")} 2s ease-in-out infinite;
`;

const Actions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
  max-width: 280px;
  margin-top: 0.25rem;
`;

interface LoadingOverlayProps {
	title: string;
	subtitle?: string;
	/** Replaces the spinner (e.g. an error icon). */
	icon?: ReactNode;
	/** Buttons shown under the text; omit for a plain busy state. */
	children?: ReactNode;
}

/**
 * Full-screen blocking state: a busy spinner by default, or — with `icon`
 * and action buttons — an error the user has to resolve.
 */
export function LoadingOverlay({ title, subtitle, icon, children }: LoadingOverlayProps) {
	const busy = !icon;
	return (
		<Overlay role={busy ? "status" : "alertdialog"} aria-live="polite" aria-label={title}>
			{icon ?? <Spinner />}
			<Title>{title}</Title>
			{subtitle && <Subtitle $pulse={busy}>{subtitle}</Subtitle>}
			{children && <Actions>{children}</Actions>}
		</Overlay>
	);
}
