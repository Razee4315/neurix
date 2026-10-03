import { Icon } from "@/components/ui/Icon";
import { NeurixLogo } from "@/components/ui/NeurixLogo";
import { alpha } from "@/theme/alpha";
import { tokens } from "@/theme/tokens";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
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
	/**
	 * Show a back button for pages that sit below a tab (history, about,
	 * editor). A string is the route to go to, `true` goes back in history,
	 * and a function lets the page decide (e.g. to confirm unsaved changes).
	 * Needed on desktop, where there is no system back button.
	 */
	back?: string | true | (() => void);
}

const Shell = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  background: ${tokens.colors.background};
  overflow: hidden;
  padding-top: env(safe-area-inset-top, 0px);
`;

const TopBar = styled.header<{ $hasSubtitle: boolean }>`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ $hasSubtitle }) => ($hasSubtitle ? "0.375rem 0.875rem" : "0 0.75rem")};
  min-height: 56px;
  flex-shrink: 0;
  background: ${tokens.colors.surfaceContainerLow};
  border-bottom: 1px solid ${alpha(tokens.colors.outlineVariant, "4d")};
  gap: 0.5rem;
`;

const TitleGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  flex: 1;
`;

const BackBtn = styled.button`
  width: 40px;
  height: 40px;
  margin-left: -0.25rem;
  border-radius: ${tokens.borderRadius.xl};
  border: none;
  background: transparent;
  color: ${tokens.colors.onSurface};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: background ${tokens.transitions.fast};

  &:hover { background: ${tokens.colors.surfaceContainerHigh}; }
  &:active { transform: scale(0.92); }
`;

const TitleStack = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 1px;
`;

const PageTitle = styled.h1`
  font-family: ${tokens.typography.fontFamily.headline};
  font-size: ${tokens.typography.fontSize.lg};
  font-weight: ${tokens.typography.fontWeight.bold};
  color: ${tokens.colors.onSurface};
  line-height: 1.1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
 * where the active character + model pill is the primary identifier.
 */
const PrimarySlot = styled.div`
  display: flex;
  align-items: center;
  min-width: 0;
  flex: 1;
`;

const contentIn = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
`;

const Content = styled.main`
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
  animation: ${contentIn} 0.25s ease-out both;

  &::-webkit-scrollbar {
    width: 0;
  }
  scrollbar-width: none;
`;

export function AppLayout({ children, title, subtitle, rightActions, hideLogo, back }: AppLayoutProps) {
	const navigate = useNavigate();
	const hasSubtitle = subtitle != null && subtitle !== false;
	return (
		<Shell>
			<TopBar $hasSubtitle={hasSubtitle && !!title}>
				<TitleGroup>
					{back ? (
						<BackBtn
							type="button"
							aria-label="Back"
							onClick={() => {
								if (typeof back === "function") back();
								else if (back === true) navigate(-1);
								else navigate(back);
							}}
						>
							<Icon name="arrow_back" size={20} />
						</BackBtn>
					) : (
						!hideLogo && <NeurixLogo size={24} />
					)}
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
