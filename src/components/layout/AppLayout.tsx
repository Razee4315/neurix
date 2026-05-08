import { NeurixLogo } from "@/components/ui/NeurixLogo";
import { tokens } from "@/theme/tokens";
import type { ReactNode } from "react";
import styled, { keyframes } from "styled-components";
import { BottomNav } from "./BottomNav";

interface AppLayoutProps {
	children: ReactNode;
	title?: string;
	/**
	 * Optional small line shown under the title. Useful for compact metadata
	 * (active character, model name, etc.) so the action area can stay roomy.
	 */
	subtitle?: ReactNode;
	rightActions?: ReactNode;
	/**
	 * When true, hides the global Neurix logo from the top bar. Use on pages
	 * (like the chat page) where the page identity is conveyed by a richer
	 * primary control and the small logo just adds noise.
	 */
	hideLogo?: boolean;
}

const Shell = styled.div`
  display: flex;
  flex-direction: column;
  height: 100dvh;
  height: 100vh;
  background: ${tokens.colors.background};
  overflow: hidden;
  padding-top: env(safe-area-inset-top, 0px);
`;

const TopBar = styled.header<{ $hasSubtitle: boolean }>`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ $hasSubtitle }) => ($hasSubtitle ? "0.375rem 0.875rem" : "0 1rem")};
  min-height: 56px;
  flex-shrink: 0;
  background: ${tokens.colors.surfaceContainerLow};
  border-bottom: 1px solid ${tokens.colors.outlineVariant}30;
  gap: 0.5rem;
`;

const TitleGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  flex: 1;
`;

const TitleStack = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 1px;
`;

const PageTitle = styled.span`
  font-family: ${tokens.typography.fontFamily.headline};
  font-size: ${tokens.typography.fontSize.lg};
  font-weight: ${tokens.typography.fontWeight.bold};
  color: ${tokens.colors.onSurface};
  line-height: 1.1;
`;

const Subtitle = styled.div`
  font-size: ${tokens.typography.fontSize.xs};
  color: ${tokens.colors.onSurfaceVariant};
  line-height: 1.2;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
`;

/**
 * Slot used when a page passes a subtitle but no title — e.g. the chat page,
 * where the active character + model pill is the primary identifier and the
 * word "Chat" was redundant against the bottom-nav label.
 */
const PrimarySlot = styled.div`
  display: flex;
  align-items: center;
  min-width: 0;
  flex: 1;
`;

const contentSlideIn = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
`;

const Content = styled.main`
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
  animation: ${contentSlideIn} 0.25s ease-out both;

  &::-webkit-scrollbar {
    width: 0;
  }
  scrollbar-width: none;
`;

export function AppLayout({ children, title, subtitle, rightActions, hideLogo }: AppLayoutProps) {
	const hasSubtitle = subtitle != null && subtitle !== false;
	return (
		<Shell>
			<TopBar $hasSubtitle={hasSubtitle && !!title}>
				<TitleGroup>
					{!hideLogo && <NeurixLogo size={22} />}
					{title ? (
						<TitleStack>
							<PageTitle>{title}</PageTitle>
							{hasSubtitle && <Subtitle>{subtitle}</Subtitle>}
						</TitleStack>
					) : (
						hasSubtitle && <PrimarySlot>{subtitle}</PrimarySlot>
					)}
				</TitleGroup>
				{rightActions && <Actions>{rightActions}</Actions>}
			</TopBar>
			<Content>{children}</Content>
			<BottomNav />
		</Shell>
	);
}
