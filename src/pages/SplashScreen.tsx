import { Icon } from "@/components/ui/Icon";
import { NeurixLogo } from "@/components/ui/NeurixLogo";
import { modelService } from "@/services";
import { tokens } from "@/theme/tokens";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import styled, { keyframes } from "styled-components";

/* ── Animations ── */

const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
`;

const subtleFloat = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
`;

const glowPulse = keyframes`
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
`;

/* ── Layout ── */

const Container = styled.div`
  height: 100dvh;
  height: 100vh;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  overflow: hidden;
  padding: clamp(1.5rem, 4vh, 3rem) 1.5rem clamp(1rem, 2vh, 1.5rem);
  background: ${tokens.colors.background};
  position: relative;

  /* Subtle ambient light from top */
  &::before {
    content: "";
    position: absolute;
    top: -30%;
    left: 50%;
    transform: translateX(-50%);
    width: 120%;
    height: 60%;
    background: radial-gradient(
      ellipse at center,
      rgba(143, 245, 255, 0.04) 0%,
      transparent 70%
    );
    pointer-events: none;
  }
`;

/* ── Hero Section (Logo + Text) ── */

const HeroSection = styled.main`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 24rem;
  text-align: center;
  min-height: 0;
  gap: clamp(1.25rem, 3.5vh, 2.5rem);
  position: relative;
  z-index: 1;
`;

const LogoBlock = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(0.75rem, 2vh, 1.25rem);
  animation: ${fadeUp} 0.7s ease-out both;
`;

const LogoWrapper = styled.div`
  position: relative;
  animation: ${subtleFloat} 4s ease-in-out infinite;

  /* Glow behind logo */
  &::after {
    content: "";
    position: absolute;
    inset: -20%;
    background: radial-gradient(
      circle,
      rgba(143, 245, 255, 0.15) 0%,
      transparent 70%
    );
    border-radius: ${tokens.borderRadius.circle};
    animation: ${glowPulse} 3s ease-in-out infinite;
    pointer-events: none;
    z-index: -1;
  }
`;

const BrandName = styled.h1`
  font-family: ${tokens.typography.fontFamily.headline};
  font-size: clamp(2.25rem, 8vw, 3.25rem);
  font-weight: ${tokens.typography.fontWeight.bold};
  letter-spacing: ${tokens.typography.letterSpacing.tighter};
  color: ${tokens.colors.onSurface};
  line-height: 1;

  span {
    color: ${tokens.colors.primary};
  }
`;

const TextBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: clamp(0.5rem, 1.5vh, 1rem);
  animation: ${fadeUp} 0.7s ease-out 0.15s both;
`;

const Headline = styled.h2`
  font-family: ${tokens.typography.fontFamily.headline};
  font-size: clamp(1.5rem, 5.5vw, 2.25rem);
  font-weight: ${tokens.typography.fontWeight.bold};
  line-height: ${tokens.typography.lineHeight.snug};
  letter-spacing: ${tokens.typography.letterSpacing.tight};
  color: ${tokens.colors.onSurface};
  text-wrap: balance;
`;

const AccentText = styled.span`
  color: ${tokens.colors.primaryDim};
`;

const Subtitle = styled.p`
  color: ${tokens.colors.onSurfaceVariant};
  font-size: ${tokens.typography.fontSize.base};
  max-width: 280px;
  margin: 0 auto;
  line-height: ${tokens.typography.lineHeight.relaxed};
`;

/* ── Footer ── */

const Footer = styled.footer`
  width: 100%;
  max-width: 22rem;
  display: flex;
  flex-direction: column;
  gap: clamp(0.75rem, 2vh, 1.25rem);
  flex-shrink: 0;
  animation: ${fadeUp} 0.7s ease-out 0.3s both;
`;

const GetStartedButton = styled.button`
  width: 100%;
  padding: 0.875rem;
  border-radius: ${tokens.borderRadius.xl};
  background: linear-gradient(
    to right,
    ${tokens.colors.primary},
    ${tokens.colors.primaryContainer}
  );
  color: ${tokens.colors.onPrimaryFixed};
  font-family: ${tokens.typography.fontFamily.label};
  font-size: ${tokens.typography.fontSize.md};
  font-weight: ${tokens.typography.fontWeight.bold};
  border: none;
  cursor: pointer;
  transition: transform ${tokens.transitions.normal};
  box-shadow: ${tokens.shadows.glow.primary};

  &:hover {
    transform: scale(0.98);
  }
  &:active {
    transform: scale(0.95);
  }
`;

const SecurityBadge = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
`;

const BadgeLabel = styled.span`
  font-family: ${tokens.typography.fontFamily.label};
  font-size: ${tokens.typography.fontSize.sm};
  text-transform: uppercase;
  letter-spacing: ${tokens.typography.letterSpacing.widest};
  color: ${tokens.colors.secondary};
  font-weight: ${tokens.typography.fontWeight.semibold};
`;

/* ── System Status ── */

const StatusSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const StatusDivider = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const StatusLine = styled.div`
  flex: 1;
  height: 1px;
  background: ${tokens.colors.surfaceContainerHighest};
`;

const StatusLabel = styled.span`
  font-family: ${tokens.typography.fontFamily.label};
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: ${tokens.typography.letterSpacing.widest};
  color: ${tokens.colors.outline};
`;

const StatusGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.625rem;
`;

const StatusCard = styled.div`
  background: ${tokens.colors.surfaceContainerLow};
  padding: 0.5rem 0.625rem;
  border-radius: ${tokens.borderRadius.lg};
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const StatusDot = styled.div`
  width: 6px;
  height: 6px;
  border-radius: ${tokens.borderRadius.circle};
  background: ${tokens.colors.secondary};
  flex-shrink: 0;
`;

const StatusText = styled.span`
  font-size: 10px;
  font-family: ${tokens.typography.fontFamily.mono};
  color: ${tokens.colors.onSurfaceVariant};
  text-transform: uppercase;
  letter-spacing: ${tokens.typography.letterSpacing.tighter};
`;

/* ── Component ── */

export function SplashScreen() {
	const navigate = useNavigate();

	useEffect(() => {
		const timer = setTimeout(async () => {
			try {
				const models = await modelService.getDownloadedModels();
				if (models.length > 0) {
					navigate("/chat", { replace: true });
				}
			} catch {
				// first launch or error — stay on splash
			}
		}, 1500);
		return () => clearTimeout(timer);
	}, [navigate]);

	return (
		<Container data-testid="splash-screen">
			<HeroSection>
				<LogoBlock>
					<LogoWrapper>
						<NeurixLogo size={80} />
					</LogoWrapper>
					<BrandName>
						NEU<span>RIX</span>
					</BrandName>
				</LogoBlock>

				<TextBlock>
					<Headline>
						Your AI. Your phone. <AccentText>No cloud.</AccentText>
					</Headline>
					<Subtitle>
						Sovereign intelligence processed entirely on-device. Zero data
						leaving your hardware.
					</Subtitle>
				</TextBlock>
			</HeroSection>

			<Footer>
				<GetStartedButton
					onClick={() => navigate("/onboarding")}
					data-testid="get-started-button"
				>
					Get Started
				</GetStartedButton>
				<SecurityBadge>
					<Icon
						name="verified_user"
						size={14}
						fill
						color={tokens.colors.secondary}
					/>
					<BadgeLabel>No account needed</BadgeLabel>
				</SecurityBadge>

				<StatusSection>
					<StatusDivider>
						<StatusLine />
						<StatusLabel>System Status</StatusLabel>
						<StatusLine />
					</StatusDivider>
					<StatusGrid>
						<StatusCard>
							<StatusDot />
							<StatusText>NPU Active</StatusText>
						</StatusCard>
						<StatusCard>
							<StatusDot />
							<StatusText>Encrypted</StatusText>
						</StatusCard>
					</StatusGrid>
				</StatusSection>
			</Footer>
		</Container>
	);
}
