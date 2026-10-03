import { Icon } from "@/components/ui/Icon";
import { EmptyArt, type EmptyArtKind } from "@/components/ui/Illustrations";
import { tokens } from "@/theme/tokens";
import type { ReactNode } from "react";
import styled, { keyframes } from "styled-components";

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
`;

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2.5rem 1.5rem;
  text-align: center;
  animation: ${fadeIn} 0.3s ease-out both;
`;

const IconWrap = styled.div`
  width: 52px;
  height: 52px;
  border-radius: ${tokens.borderRadius.circle};
  background: ${tokens.colors.surfaceContainerHigh};
  color: ${tokens.colors.outline};
  display: flex;
  align-items: center;
  justify-content: center;
`;

const Message = styled.p`
  font-family: ${tokens.typography.fontFamily.headline};
  font-size: ${tokens.typography.fontSize.md};
  font-weight: ${tokens.typography.fontWeight.semibold};
  color: ${tokens.colors.onSurface};
  max-width: 260px;
  margin-top: 0.875rem;
`;

const Subtitle = styled.p`
  font-size: ${tokens.typography.fontSize.sm};
  color: ${tokens.colors.onSurfaceVariant};
  max-width: 280px;
  margin-top: 0.375rem;
  line-height: ${tokens.typography.lineHeight.relaxed};
`;

const Actions = styled.div`
  margin-top: 1rem;
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: center;
`;

interface EmptyStateProps {
	/** Illustration to show. Takes precedence over `icon`. */
	art?: EmptyArtKind;
	icon?: string;
	message?: string;
	subtitle?: string;
	/** Call-to-action buttons. */
	children?: ReactNode;
}

export function EmptyState({
	art,
	icon = "search",
	message = "No results found",
	subtitle,
	children,
}: EmptyStateProps) {
	return (
		<Container>
			{art ? (
				<EmptyArt kind={art} />
			) : (
				<IconWrap>
					<Icon name={icon} size={24} />
				</IconWrap>
			)}
			<Message>{message}</Message>
			{subtitle && <Subtitle>{subtitle}</Subtitle>}
			{children && <Actions>{children}</Actions>}
		</Container>
	);
}
