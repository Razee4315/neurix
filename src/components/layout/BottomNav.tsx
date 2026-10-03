import { Icon } from "@/components/ui/Icon";
import { alpha } from "@/theme/alpha";
import { tokens } from "@/theme/tokens";
import { vibrate } from "@/utils/platform";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import styled from "styled-components";

/**
 * `owns` lists route prefixes that belong to a tab without sharing its path,
 * so sub-pages (the character editor, About, a running download) still show
 * where the user is.
 */
const NAV_TABS = [
	{ icon: "chat_bubble", label: "Chat", path: "/chat", owns: ["/character"] },
	{ icon: "deployed_code", label: "Models", path: "/models", owns: [] },
	{ icon: "storefront", label: "Store", path: "/store", owns: ["/downloading"] },
	{ icon: "settings", label: "Settings", path: "/settings", owns: ["/about"] },
] as const;

const NavOuter = styled.div`
  width: 100%;
  flex-shrink: 0;
  background: ${tokens.colors.surfaceContainerLow};
  border-top: 1px solid ${alpha(tokens.colors.outlineVariant, "4d")};
  padding-bottom: env(safe-area-inset-bottom, 0px);
  display: flex;
  justify-content: center;
`;

const NavBar = styled.nav`
  display: flex;
  align-items: center;
  justify-content: space-around;
  width: 100%;
  max-width: 420px;
  height: 60px;
  padding: 0 0.25rem;
`;

const Tab = styled.button<{ $active: boolean }>`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  flex: 1;
  height: 100%;
  border: none;
  background: transparent;
  cursor: pointer;
  color: ${({ $active }) => ($active ? tokens.colors.primary : tokens.colors.onSurfaceVariant)};
  transition: color ${tokens.transitions.normal}, transform ${tokens.transitions.fast};

  &:hover { color: ${({ $active }) => ($active ? tokens.colors.primary : tokens.colors.onSurface)}; }
  &:active { transform: scale(0.92); }
`;

const Pill = styled.span<{ $active: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 28px;
  border-radius: 14px;
  background: ${({ $active }) => ($active ? alpha(tokens.colors.primary, "24") : "transparent")};
  transition: background ${tokens.transitions.normal};
`;

const TabLabel = styled.span<{ $active: boolean }>`
  font-family: ${tokens.typography.fontFamily.label};
  font-size: 11px;
  font-weight: ${({ $active }) =>
		$active ? tokens.typography.fontWeight.bold : tokens.typography.fontWeight.medium};
  line-height: 1;
`;

export function BottomNav() {
	const location = useLocation();
	const navigate = useNavigate();
	const [keyboardOpen, setKeyboardOpen] = useState(false);
	const initialHeightRef = useRef(Math.max(window.screen.height, window.innerHeight));

	// Hide the bar while the on-screen keyboard is up so it doesn't sit
	// between the input and the keys.
	useEffect(() => {
		const vv = window.visualViewport;
		if (!vv) return;
		const onResize = () => setKeyboardOpen(vv.height < initialHeightRef.current * 0.75);
		vv.addEventListener("resize", onResize);
		return () => vv.removeEventListener("resize", onResize);
	}, []);

	if (keyboardOpen) return null;

	return (
		<NavOuter>
			<NavBar aria-label="Main">
				{NAV_TABS.map((tab) => {
					const isActive =
						location.pathname.startsWith(tab.path) ||
						tab.owns.some((prefix) => location.pathname.startsWith(prefix));
					return (
						<Tab
							key={tab.path}
							type="button"
							$active={isActive}
							onClick={() => {
								vibrate(5);
								navigate(tab.path);
							}}
							aria-current={isActive ? "page" : undefined}
						>
							<Pill $active={isActive}>
								<Icon name={tab.icon} size={21} fill={isActive} />
							</Pill>
							<TabLabel $active={isActive}>{tab.label}</TabLabel>
						</Tab>
					);
				})}
			</NavBar>
		</NavOuter>
	);
}
