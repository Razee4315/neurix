import type React from "react";
import styled, { keyframes } from "styled-components";
import { tokens } from "@/theme/tokens";
import { Button } from "@/components/ui/Button";

interface WelcomeScreenProps {
  onGetStarted: () => void;
}

const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
`;

const pulseGlow = keyframes`
  0%, 100% { filter: drop-shadow(0 0 8px rgba(0, 240, 255, 0.4)); }
  50% { filter: drop-shadow(0 0 20px rgba(0, 240, 255, 0.8)) drop-shadow(0 0 40px rgba(0, 240, 255, 0.3)); }
`;

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100vh;
  height: 100dvh;
  background: ${tokens.colors.background.darkest};
  font-family: ${tokens.typography.fontFamily.primary};
  position: relative;
  overflow: hidden;

  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 60% 50% at 50% 0%, rgba(0, 240, 255, 0.07) 0%, transparent 70%),
      radial-gradient(ellipse 40% 30% at 80% 80%, rgba(57, 255, 20, 0.04) 0%, transparent 60%);
    pointer-events: none;
  }

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(0, 240, 255, 0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0, 240, 255, 0.03) 1px, transparent 1px);
    background-size: 40px 40px;
    pointer-events: none;
    mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%);
  }
`;

const Content = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${tokens.spacing.xl};
  max-width: 420px;
  padding: 0 ${tokens.spacing.lg};
  text-align: center;
  position: relative;
  z-index: 1;
`;

const LogoWrapper = styled.div`
  animation: ${fadeUp} 0.5s ease-out both, ${pulseGlow} 3s ease-in-out infinite;
  animation-delay: 0s, 0.8s;
`;

const NeurixLogo: React.FC<{ size?: number }> = ({ size = 80 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="Neurix logo"
  >
    <rect width="100" height="100" fill="#0A0A0B" rx="18" />
    <path
      d="M 35 20 L 20 20 L 20 80 L 35 80"
      stroke="#00F0FF"
      strokeWidth="8"
      fill="none"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
    <path
      d="M 65 20 L 80 20 L 80 80 L 65 80"
      stroke="#00F0FF"
      strokeWidth="8"
      fill="none"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
    <circle cx="50" cy="50" r="10" fill="#39FF14" />
  </svg>
);

const AppName = styled.h1`
  font-family: ${tokens.typography.fontFamily.heading};
  font-size: ${tokens.typography.fontSize["4xl"]};
  font-weight: ${tokens.typography.fontWeight.bold};
  color: ${tokens.colors.text.primary};
  letter-spacing: -0.03em;
  margin: 0;
  animation: ${fadeUp} 0.5s ease-out 0.1s both;

  span {
    color: ${tokens.colors.primary};
  }

  @media (max-width: 375px) {
    font-size: ${tokens.typography.fontSize["3xl"]};
  }
`;

const Tagline = styled.p`
  font-size: ${tokens.typography.fontSize.lg};
  color: ${tokens.colors.text.secondary};
  line-height: ${tokens.typography.lineHeight.relaxed};
  margin: 0;
  animation: ${fadeUp} 0.5s ease-out 0.2s both;
`;

const Divider = styled.div`
  width: 48px;
  height: 2px;
  background: linear-gradient(90deg, ${tokens.colors.primary}, ${tokens.colors.secondary});
  border-radius: ${tokens.borderRadius.full};
  animation: ${fadeUp} 0.5s ease-out 0.25s both;
`;

const ButtonWrap = styled.div`
  width: 100%;
  max-width: 280px;
  animation: ${fadeUp} 0.5s ease-out 0.3s both;
`;

const VersionBadge = styled.div`
  font-family: ${tokens.typography.fontFamily.monospace};
  font-size: ${tokens.typography.fontSize.xs};
  color: ${tokens.colors.text.disabled};
  letter-spacing: 0.08em;
  animation: ${fadeUp} 0.5s ease-out 0.4s both;
`;

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onGetStarted,
}) => (
  <Container data-testid="welcome-screen">
    <Content>
      <LogoWrapper>
        <NeurixLogo size={88} />
      </LogoWrapper>
      <AppName>
        Neu<span>rix</span>
      </AppName>
      <Divider />
      <Tagline>
        Your AI. Your phone. No cloud. No subscription. No limits.
      </Tagline>
      <ButtonWrap>
        <Button
          variant="primary"
          fullWidth
          onClick={onGetStarted}
          data-testid="get-started-button"
        >
          Get Started
        </Button>
      </ButtonWrap>
      <VersionBadge>v0.1.0 — ALPHA</VersionBadge>
    </Content>
  </Container>
);
