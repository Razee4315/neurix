import { NeurixLogo } from "@/components/ui/NeurixLogo";
import { tokens } from "@/theme/tokens";
import type { ReactNode } from "react";
import styled, { keyframes } from "styled-components";
import { BottomNav } from "./BottomNav";

interface AppLayoutProps {
	children: ReactNode;
	title?: string;
	rightActions?: ReactNode;
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

const TopBar = styled.header`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.25rem;
  height: 56px;
  flex-shrink: 0;
  background: ${tokens.colors.surfaceContainerLow};
`;

const TitleGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const PageTitle = styled.span`
  font-family: ${tokens.typography.fontFamily.headline};
  font-size: ${tokens.typography.fontSize.lg};
  font-weight: ${tokens.typography.fontWeight.bold};
  color: ${tokens.colors.onSurface};
`;

const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
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

export function AppLayout({ children, title, rightActions }: AppLayoutProps) {
	return (
		<Shell>
			<TopBar>
				<TitleGroup>
					<NeurixLogo size={22} />
					{title && <PageTitle>{title}</PageTitle>}
				</TitleGroup>
				{rightActions && <Actions>{rightActions}</Actions>}
			</TopBar>
			<Content>{children}</Content>
			<BottomNav />
		</Shell>
	);
}
