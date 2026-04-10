import { Icon } from "@/components/ui/Icon";
import { tokens } from "@/theme/tokens";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import styled, { css, keyframes } from "styled-components";

const NAV_TABS = [
	{ icon: "chat_bubble", label: "Chat", path: "/chat" },
	{ icon: "deployed_code", label: "Models", path: "/models" },
	{ icon: "storefront", label: "Store", path: "/store" },
	{ icon: "settings", label: "Settings", path: "/settings" },
] as const;

/* ── Floating glass nav bar ── */

const NavOuter = styled.div`
  width: 100%;
  flex-shrink: 0;
  background: ${tokens.colors.surfaceContainerLow};
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  padding-bottom: env(safe-area-inset-bottom, 0px);
  display: flex;
  justify-content: center;
`;

const NavBar = styled.nav`
  display: flex;
  align-items: center;
  justify-content: space-around;
  width: 100%;
  max-width: 360px;
  height: 56px;
  padding: 0 0.25rem;
`;

/* ── Tab button ── */

const labelSlide = keyframes`
  from { opacity: 0; max-width: 0; margin-left: 0; }
  to { opacity: 1; max-width: 60px; margin-left: 6px; }
`;

const Tab = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  cursor: pointer;
  padding: 0.5rem 0.75rem;
  border-radius: 20px;
  transition: background 0.25s ease, transform 0.15s ease;
  background: ${({ $active }) =>
		$active ? `${tokens.colors.primary}18` : "transparent"};

  &:active { transform: scale(0.9); }
`;

const TabLabel = styled.span<{ $active: boolean }>`
  font-family: ${tokens.typography.fontFamily.label};
  font-size: 12px;
  font-weight: ${tokens.typography.fontWeight.bold};
  color: ${tokens.colors.primary};
  white-space: nowrap;
  overflow: hidden;

  ${({ $active }) => $active
		? css`animation: ${labelSlide} 0.25s ease-out both;`
		: css`max-width: 0; opacity: 0; margin-left: 0;`
	}
`;

/* ── Component ── */

export function BottomNav() {
	const location = useLocation();
	const navigate = useNavigate();
	const [keyboardOpen, setKeyboardOpen] = useState(false);
	const initialHeightRef = useRef(
		Math.max(window.screen.height, window.innerHeight),
	);

	useEffect(() => {
		const vv = window.visualViewport;
		if (!vv) return;

		const onResize = () => {
			const stableHeight = initialHeightRef.current;
			const keyboardVisible = vv.height < stableHeight * 0.75;
			setKeyboardOpen(keyboardVisible);
		};

		vv.addEventListener("resize", onResize);
		return () => vv.removeEventListener("resize", onResize);
	}, []);

	if (keyboardOpen) return null;

	return (
		<NavOuter>
			<NavBar>
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
			</NavBar>
		</NavOuter>
	);
}
