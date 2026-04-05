import { Icon } from "@/components/ui/Icon";
import { tokens } from "@/theme/tokens";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import styled, { keyframes } from "styled-components";

const NAV_TABS = [
	{ icon: "storefront", label: "Store", path: "/store" },
	{ icon: "deployed_code", label: "Models", path: "/models" },
	{ icon: "chat_bubble", label: "Chat", path: "/chat" },
	{ icon: "settings", label: "Settings", path: "/settings" },
] as const;

const Nav = styled.nav`
  width: 100%;
  flex-shrink: 0;
  background: ${tokens.colors.surfaceContainerLowest};
  box-shadow: ${tokens.shadows.nav};
  padding-bottom: env(safe-area-inset-bottom, 0px);
`;

const TabList = styled.div`
  display: flex;
  justify-content: space-around;
  align-items: center;
  height: 60px;
  padding: 0 0.5rem;
`;

const tabActivate = keyframes`
  0% { transform: scale(0.92); }
  60% { transform: scale(1.04); }
  100% { transform: scale(1); }
`;

const Tab = styled.button<{ $active: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 0.375rem 0.75rem;
  border: none;
  background: ${({ $active }) =>
		$active ? tokens.colors.surfaceContainerHigh : "transparent"};
  border-radius: ${tokens.borderRadius.md};
  cursor: pointer;
  transition: background 0.25s ease, color ${tokens.transitions.fast};
  min-width: 56px;
  ${({ $active }) => $active && `animation: ${tabActivate} 0.3s ease-out;`}
`;

const TabLabel = styled.span<{ $active: boolean }>`
  font-family: ${tokens.typography.fontFamily.label};
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: ${tokens.typography.letterSpacing.wide};
  color: ${({ $active }) =>
		$active ? tokens.colors.primary : tokens.colors.onSurfaceVariant};
  transition: color ${tokens.transitions.fast};
`;

export function BottomNav() {
	const location = useLocation();
	const navigate = useNavigate();
	const [keyboardOpen, setKeyboardOpen] = useState(false);
	// Capture the full viewport height once on mount — before any keyboard opens.
	// On Android with adjustResize, window.innerHeight shrinks WITH the keyboard,
	// so comparing visualViewport.height against window.innerHeight always passes.
	// screen.height is stable and never changes, making it the correct reference.
	const initialHeightRef = useRef(
		Math.max(window.screen.height, window.innerHeight),
	);

	useEffect(() => {
		const vv = window.visualViewport;
		if (!vv) return;

		const onResize = () => {
			const stableHeight = initialHeightRef.current;
			// Keyboard is open when viewport shrinks by 25%+ of the stable reference
			const keyboardVisible = vv.height < stableHeight * 0.75;
			setKeyboardOpen(keyboardVisible);
		};

		vv.addEventListener("resize", onResize);
		return () => vv.removeEventListener("resize", onResize);
	}, []);

	if (keyboardOpen) return null;

	return (
		<Nav>
			<TabList>
				{NAV_TABS.map((tab) => {
					const isActive =
						location.pathname.startsWith(tab.path) ||
						(tab.path === "/store" && location.pathname === "/downloading");
					return (
						<Tab
							key={tab.path}
							$active={isActive}
							onClick={() => {
								if (navigator.vibrate) navigator.vibrate(5);
								navigate(tab.path);
							}}
						>
							<Icon
								name={tab.icon}
								size={22}
								fill={isActive}
								color={
									isActive
										? tokens.colors.primary
										: tokens.colors.onSurfaceVariant
								}
							/>
							<TabLabel $active={isActive}>{tab.label}</TabLabel>
						</Tab>
					);
				})}
			</TabList>
		</Nav>
	);
}
