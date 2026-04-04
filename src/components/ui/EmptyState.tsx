import { Icon } from "@/components/ui/Icon";
import { tokens } from "@/theme/tokens";
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
  padding: 3rem 1.5rem;
  text-align: center;
  animation: ${fadeIn} 0.3s ease-out both;
`;

const IconWrap = styled.div`
  width: 48px;
  height: 48px;
  border-radius: ${tokens.borderRadius.circle};
  background: ${tokens.colors.surfaceContainerHigh};
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.75rem;
`;

const Message = styled.p`
  font-size: ${tokens.typography.fontSize.base};
  color: ${tokens.colors.onSurfaceVariant};
  max-width: 220px;
`;

interface EmptyStateProps {
	icon?: string;
	message?: string;
}

export function EmptyState({
	icon = "search_off",
	message = "No results found",
}: EmptyStateProps) {
	return (
		<Container>
			<IconWrap>
				<Icon name={icon} size={24} color={tokens.colors.outline} />
			</IconWrap>
			<Message>{message}</Message>
		</Container>
	);
}
