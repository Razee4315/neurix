import { Icon } from "@/components/ui/Icon";
import { NeurixLogo } from "@/components/ui/NeurixLogo";
import { modelService, settingsService } from "@/services";
import { tokens } from "@/theme/tokens";
import { useEffect, useState } from "react";
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


/* ── Component ── */

export function SplashScreen() {
	const navigate = useNavigate();
	const [ready, setReady] = useState(false);

	useEffect(() => {
		let cancelled = false;

		(async () => {
			try {
				const [models, settings] = await Promise.all([
					modelService.getDownloadedModels(),
					settingsService.getSettings(),
				]);
				if (cancelled) return;

				if (models.length > 0) {
					// Returning user — try to load last model, then go to chat
					let modelLoaded = false;
					if (settings.last_model_id) {
						const exists = models.find((m) => m.id === settings.last_model_id);
						if (exists) {
							try {
								await modelService.loadModel(exists.id);
								modelLoaded = true;
							} catch {
								// model load failed
							}
						}
					}
					navigate(modelLoaded ? "/chat" : "/models", { replace: true });
					return;
				}
			} catch {
				// first launch or error — show splash
			}

			if (!cancelled) setReady(true);
		})();

		return () => { cancelled = true; };
	}, [navigate]);

	// Show a branded loading screen while the app boots (instead of blank white/black screen)
	if (!ready) return (
		<Container>
			<HeroSection>
				<LogoBlock>
					<LogoWrapper>
						<NeurixLogo size={64} />
					</LogoWrapper>
					<BrandName>
						NEU<span>RIX</span>
					</BrandName>
				</LogoBlock>
			</HeroSection>
		</Container>
	);

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
					<BadgeLabel>100% Private</BadgeLabel>
				</SecurityBadge>
			</Footer>
		</Container>
	);
}
