import { Icon } from "@/components/ui/Icon";
import { NeurixLogo } from "@/components/ui/NeurixLogo";
import { useAppContext } from "@/context/AppContext";
import { alpha } from "@/theme/alpha";
import { tokens } from "@/theme/tokens";
import { vibrate } from "@/utils/platform";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled, { css, keyframes } from "styled-components";

/* ── Step Data ── */

interface OnboardingStep {
	stepNumber: string;
	icon: string;
	iconColor: string;
	headline: string;
	highlightWord: string;
	description: string;
	badge: string;
}

const STEPS: OnboardingStep[] = [
	{
		stepNumber: "01",
		icon: "neurology",
		iconColor: tokens.colors.primary,
		headline: "Sovereign",
		highlightWord: "intelligence.",
		description:
			"Download a model once and run it right here on your device. No servers, no accounts, no subscription.",
		badge: "LOCAL PROCESSING",
	},
	{
		stepNumber: "02",
		icon: "airplanemode_active",
		iconColor: tokens.colors.secondary,
		headline: "Run",
		highlightWord: "offline.",
		description:
			"After the download, no connection is needed. It works on a flight, on a mountain road, anywhere.",
		badge: "ON-DEVICE ONLY",
	},
	{
		stepNumber: "03",
		icon: "enhanced_encryption",
		iconColor: tokens.colors.secondary,
		headline: "Total",
		highlightWord: "privacy.",
		description:
			"Your conversations never leave your device. Nothing is collected or tracked. Next, pick a model — Llama 3.2 1B is a good first one.",
		badge: "ZERO DATA COLLECTION",
	},
];

/* ── Animations ── */

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
`;

const iconPulse = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
`;

/* ── Layout ── */

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100dvh;
  height: 100vh;
  background: ${tokens.colors.background};
  overflow: hidden;
  position: relative;
`;

/* ── Header ── */

const Header = styled.header`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.5rem;
  flex-shrink: 0;
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

const SkipButton = styled.button`
  background: none;
  border: none;
  color: ${tokens.colors.onSurfaceVariant};
  font-family: ${tokens.typography.fontFamily.label};
  font-size: ${tokens.typography.fontSize.sm};
  font-weight: ${tokens.typography.fontWeight.medium};
  letter-spacing: ${tokens.typography.letterSpacing.widest};
  cursor: pointer;
  padding: 0.5rem;
  transition: color ${tokens.transitions.fast};

  &:hover {
    color: ${tokens.colors.onSurface};
  }
`;

/* ── Main Content ── */

const MainContent = styled.main`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 2rem;
  min-height: 0;
`;

const StepContent = styled.div`
  max-width: 24rem;
  width: 100%;
  display: flex;
  flex-direction: column;
  animation: ${fadeIn} 0.4s ease-out both;
`;

/* ── Icon ── */

const IconCircle = styled.div<{ $color: string }>`
  width: clamp(64px, 16vw, 80px);
  height: clamp(64px, 16vw, 80px);
  border-radius: ${tokens.borderRadius.circle};
  background: ${({ $color }) => alpha($color, "12")};
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: clamp(1.5rem, 4vh, 2.5rem);
  animation: ${iconPulse} 3s ease-in-out infinite;
`;

/* ── Text ── */

const StepLabel = styled.div`
  margin-bottom: 0.375rem;
  font-family: ${tokens.typography.fontFamily.label};
  font-size: 10px;
  letter-spacing: ${tokens.typography.letterSpacing.widest};
  text-transform: uppercase;
  color: ${tokens.colors.primary};
  font-weight: ${tokens.typography.fontWeight.bold};
`;

const StepHeadline = styled.h1`
  font-family: ${tokens.typography.fontFamily.headline};
  font-size: clamp(2.25rem, 8vw, 3rem);
  font-weight: ${tokens.typography.fontWeight.bold};
  letter-spacing: ${tokens.typography.letterSpacing.tight};
  color: ${tokens.colors.onSurface};
  line-height: ${tokens.typography.lineHeight.tight};
  margin-bottom: clamp(0.75rem, 2vh, 1.25rem);
`;

const Highlight = styled.span`
  color: ${tokens.colors.primary};
  font-style: italic;
`;

const StepDescription = styled.p`
  font-family: ${tokens.typography.fontFamily.body};
  font-size: ${tokens.typography.fontSize.base};
  color: ${tokens.colors.onSurfaceVariant};
  line-height: ${tokens.typography.lineHeight.relaxed};
  margin-bottom: clamp(1rem, 3vh, 2rem);
  max-width: 320px;
`;

const PrivacyBadge = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const PrivacyBadgeLabel = styled.span`
  font-size: 10px;
  font-family: ${tokens.typography.fontFamily.label};
  color: ${tokens.colors.secondary};
  text-transform: uppercase;
  letter-spacing: ${tokens.typography.letterSpacing.widest};
  font-weight: ${tokens.typography.fontWeight.semibold};
`;

/* ── Footer ── */

const FooterSection = styled.footer`
  width: 100%;
  padding: 0.75rem 1.5rem 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
`;

const ProgressDots = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
`;

const ProgressDot = styled.div<{
	$state: "completed" | "active" | "upcoming";
}>`
  height: 4px;
  border-radius: ${tokens.borderRadius.circle};
  transition: all ${tokens.transitions.normal};

  ${({ $state }) => {
		switch ($state) {
			case "completed":
				return css`
          width: 2rem;
          background: ${alpha(tokens.colors.primary, "33")};
        `;
			case "active":
				return css`
          width: 3rem;
          background: ${tokens.colors.primary};
        `;
			case "upcoming":
				return css`
          width: 2rem;
          background: ${tokens.colors.surfaceContainerHighest};
        `;
		}
	}}
`;

const ActionBar = styled.div`
  width: 100%;
  max-width: 24rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const BackButton = styled.button`
  flex: 1;
  height: 50px;
  border-radius: ${tokens.borderRadius.md};
  background: ${tokens.colors.surfaceContainerHigh};
  color: ${tokens.colors.onSurface};
  font-family: ${tokens.typography.fontFamily.label};
  font-weight: ${tokens.typography.fontWeight.bold};
  font-size: ${tokens.typography.fontSize.sm};
  letter-spacing: ${tokens.typography.letterSpacing.widest};
  text-transform: uppercase;
  border: 1px solid ${alpha(tokens.colors.outlineVariant, "1a")};
  cursor: pointer;
  transition: all ${tokens.transitions.normal};

  &:hover {
    background: ${tokens.colors.surfaceBright};
  }
  &:active {
    transform: scale(0.98);
  }
`;

const NextButton = styled.button<{ $fullWidth: boolean }>`
  flex: ${({ $fullWidth }) => ($fullWidth ? 1 : 2)};
  height: 50px;
  border-radius: ${tokens.borderRadius.md};
  background: linear-gradient(
    135deg,
    ${tokens.colors.primary} 0%,
    ${tokens.colors.primaryContainer} 100%
  );
  color: ${tokens.colors.onPrimaryFixed};
  font-family: ${tokens.typography.fontFamily.label};
  font-weight: ${tokens.typography.fontWeight.extrabold};
  font-size: ${tokens.typography.fontSize.sm};
  letter-spacing: ${tokens.typography.letterSpacing.wider};
  text-transform: uppercase;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  box-shadow: ${tokens.shadows.glow.primary};
  transition: all ${tokens.transitions.normal};

  &:hover {
    box-shadow: 0 0 30px ${alpha(tokens.colors.primary, "40")};
  }
  &:active {
    transform: scale(0.98);
  }
`;

/* ── Component ── */

export function OnboardingScreen() {
	const navigate = useNavigate();
	const { updateSettings } = useAppContext();
	const [currentStep, setCurrentStep] = useState(0);
	const step = STEPS[currentStep];
	const touchStartRef = useRef(0);

	const isFirst = currentStep === 0;
	const isLast = currentStep === STEPS.length - 1;

	// Finishing and skipping both end the tour for good: it is not shown
	// again on the next launch.
	const finish = () => {
		updateSettings({ onboarding_done: true }).catch(() => {});
		navigate("/store");
	};

	const handleNext = () => {
		vibrate(8);
		if (isLast) finish();
		else setCurrentStep((s) => s + 1);
	};

	const handleBack = () => {
		vibrate(5);
		setCurrentStep((s) => Math.max(0, s - 1));
	};

	// Swipe left = next, swipe right = back. Swiping never finishes the tour;
	// leaving it takes a deliberate tap.
	const handleTouchStart = (e: React.TouchEvent) => {
		touchStartRef.current = e.touches[0].clientX;
	};
	const handleTouchEnd = (e: React.TouchEvent) => {
		const diff = e.changedTouches[0].clientX - touchStartRef.current;
		if (diff < -60 && !isLast) handleNext();
		else if (diff > 60 && !isFirst) handleBack();
	};

	return (
		<Container data-testid="onboarding-screen">
			<Header>
				<LogoGroup>
					<NeurixLogo size={28} />
					<BrandName>NEURIX</BrandName>
				</LogoGroup>
				<SkipButton type="button" onClick={finish}>
					SKIP
				</SkipButton>
			</Header>

			<MainContent onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
				<StepContent key={currentStep} aria-live="polite">
					<IconCircle $color={step.iconColor}>
						<Icon name={step.icon} size={36} fill color={step.iconColor} />
					</IconCircle>

					<StepLabel>
						Step {currentStep + 1} of {STEPS.length}
					</StepLabel>
					<StepHeadline>
						{step.headline} <Highlight>{step.highlightWord}</Highlight>
					</StepHeadline>
					<StepDescription>{step.description}</StepDescription>
					<PrivacyBadge>
						<Icon name="verified_user" size={14} color={tokens.colors.secondary} />
						<PrivacyBadgeLabel>{step.badge}</PrivacyBadgeLabel>
					</PrivacyBadge>
				</StepContent>
			</MainContent>

			<FooterSection>
				<ProgressDots aria-hidden="true">
					{STEPS.map((s, index) => (
						<ProgressDot
							key={s.stepNumber}
							$state={
								index < currentStep ? "completed" : index === currentStep ? "active" : "upcoming"
							}
						/>
					))}
				</ProgressDots>

				<ActionBar>
					{!isFirst && (
						<BackButton type="button" onClick={handleBack}>
							BACK
						</BackButton>
					)}
					<NextButton type="button" onClick={handleNext} $fullWidth={isFirst}>
						{isLast ? "CHOOSE A MODEL" : "NEXT"}
						<Icon name={isLast ? "check" : "arrow_forward"} size={20} />
					</NextButton>
				</ActionBar>
			</FooterSection>
		</Container>
	);
}
