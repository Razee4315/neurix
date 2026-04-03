import { NeurixLogo } from "@/components/ui/NeurixLogo";
import { tokens } from "@/theme/tokens";
import type { ReactNode } from "react";
import styled from "styled-components";
import { BottomNav } from "./BottomNav";

interface AppLayoutProps {
	children: ReactNode;
	rightActions?: ReactNode;
}

const Shell = styled.div`
  display: flex;
  flex-direction: column;
  height: 100dvh;
  height: 100vh;
  background: ${tokens.colors.background};
  overflow: hidden;
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

const LogoGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const BrandName = styled.span`
  font-family: ${tokens.typography.fontFamily.headline};
  font-size: ${tokens.typography.fontSize.xl};
  font-weight: ${tokens.typography.fontWeight.bold};
  letter-spacing: ${tokens.typography.letterSpacing.tighter};
  color: ${tokens.colors.primary};
`;

const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
`;

const Content = styled.main`
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;

  /* Hide scrollbar but keep scrollable */
  &::-webkit-scrollbar {
    width: 0;
  }
  scrollbar-width: none;
`;

export function AppLayout({ children, rightActions }: AppLayoutProps) {
	return (
		<Shell>
			<TopBar>
				<LogoGroup>
					<NeurixLogo size={26} />
					<BrandName>NEURIX</BrandName>
				</LogoGroup>
				{rightActions && <Actions>{rightActions}</Actions>}
			</TopBar>
			<Content>{children}</Content>
			<BottomNav />
		</Shell>
	);
}
