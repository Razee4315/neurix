import { NeurixLogo } from "@/components/ui/NeurixLogo";
import { tokens } from "@/theme/tokens";
import styled, { keyframes } from "styled-components";

const pulse = keyframes`
  0%, 100% { opacity: 0.6; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.04); }
`;

const Screen = styled.div`
  height: 100vh;
  height: 100dvh;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  background: ${tokens.colors.background};
`;

const Mark = styled.div`
  animation: ${pulse} 2s ease-in-out infinite;
`;

const Name = styled.div`
  font-family: ${tokens.typography.fontFamily.headline};
  font-size: 1.75rem;
  font-weight: ${tokens.typography.fontWeight.bold};
  letter-spacing: ${tokens.typography.letterSpacing.tighter};
  color: ${tokens.colors.onSurface};

  span { color: ${tokens.colors.primary}; }
`;

/**
 * Plain branded placeholder shown while the app boots or a route's code is
 * loading. It has no logic of its own, so it is safe as a Suspense fallback.
 */
export function BootScreen() {
	return (
		<Screen role="status" aria-label="Loading Neurix">
			<Mark>
				<NeurixLogo size={64} />
			</Mark>
			<Name>
				NEU<span>RIX</span>
			</Name>
		</Screen>
	);
}
