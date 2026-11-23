import { BootScreen } from "@/components/ui/BootScreen";
import { Icon } from "@/components/ui/Icon";
import { MountainScene } from "@/components/ui/Illustrations";
import { NeurixLogo } from "@/components/ui/NeurixLogo";
import { useAppContext } from "@/context/AppContext";
import { modelService, notificationService, settingsService } from "@/services";
import { alpha } from "@/theme/alpha";
import { tokens } from "@/theme/tokens";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled, { keyframes } from "styled-components";

/* ── Animations ── */

const fadeUp = keyframes`
	from { opacity: 0; transform: translateY(12px); }
	to { opacity: 1; transform: translateY(0); }
`;

/* ── Layout ── */

const Container = styled.div`
	height: 100vh;
	height: 100dvh;
	width: 100%;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: space-between;
	overflow-y: auto;
	overflow-x: hidden;
	padding: clamp(1.25rem, 3.5vh, 2.5rem) 1.5rem clamp(1rem, 2.5vh, 1.75rem);
	background: ${tokens.surfaces.page};
	position: relative;

	/* Subtle Karakoram zenith glow from top */
	&::before {
		content: "";
		position: absolute;
		top: -25%;
		left: 50%;
		transform: translateX(-50%);
		width: 110%;
		height: 55%;
		background: radial-gradient(
			ellipse at center,
			${alpha(tokens.colors.primary, "12")} 0%,
			transparent 70%
		);
		pointer-events: none;
	}
`;

/* ── Hero Section (Logo + Artwork + Copy) ── */

const HeroSection = styled.main`
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	width: 100%;
	max-width: 26rem;
	text-align: center;
	min-height: 0;
	gap: clamp(1rem, 2.5vh, 1.75rem);
	position: relative;
	z-index: 1;
`;

const LogoBlock = styled.div`
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.625rem;
	animation: ${fadeUp} 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
`;

const LogoRow = styled.div`
	display: inline-flex;
	align-items: center;
	gap: 0.75rem;
`;

const BrandName = styled.h1`
	font-family: ${tokens.typography.fontFamily.headline};
	font-size: clamp(1.75rem, 6vw, 2.375rem);
	font-weight: ${tokens.typography.fontWeight.bold};
	letter-spacing: ${tokens.typography.letterSpacing.tight};
	color: ${tokens.colors.onSurface};
	line-height: 1;

	span {
		color: ${tokens.colors.primary};
	}
`;

const Eyebrow = styled.span`
	font-family: ${tokens.typography.fontFamily.mono};
	font-size: 11px;
	font-weight: ${tokens.typography.fontWeight.semibold};
	letter-spacing: 0.14em;
	text-transform: uppercase;
	color: ${tokens.colors.onSurfaceVariant};
`;

const TextBlock = styled.div`
	display: flex;
	flex-direction: column;
	gap: 0.625rem;
	animation: ${fadeUp} 0.45s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both;
`;

const Headline = styled.h2`
	font-family: ${tokens.typography.fontFamily.headline};
	font-size: clamp(1.5rem, 5.2vw, 2.125rem);
	font-weight: ${tokens.typography.fontWeight.bold};
	line-height: ${tokens.typography.lineHeight.snug};
	letter-spacing: ${tokens.typography.letterSpacing.tight};
	color: ${tokens.colors.onSurface};
	text-wrap: balance;
`;

const AccentText = styled.span`
	color: ${tokens.colors.primary};
`;

const Subtitle = styled.p`
	color: ${tokens.colors.onSurfaceVariant};
	font-size: ${tokens.typography.fontSize.base};
	max-width: 23rem;
	margin: 0 auto;
	line-height: ${tokens.typography.lineHeight.relaxed};
`;

/* ── Footer ── */

const Footer = styled.footer`
	width: 100%;
	max-width: 24rem;
	display: flex;
	flex-direction: column;
	gap: 0.625rem;
	flex-shrink: 0;
	position: relative;
	z-index: 1;
	animation: ${fadeUp} 0.45s cubic-bezier(0.16, 1, 0.3, 1) 0.18s both;
`;

const GetStartedButton = styled.button`
	width: 100%;
	min-height: 48px;
	padding: 0.875rem 1.25rem;
	border-radius: ${tokens.borderRadius.lg};
	background: ${tokens.colors.primary};
	color: ${tokens.colors.onPrimaryFixed};
	font-family: ${tokens.typography.fontFamily.label};
	font-size: ${tokens.typography.fontSize.md};
	font-weight: ${tokens.typography.fontWeight.bold};
	border: none;
	cursor: pointer;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 0.5rem;
	transition:
		transform ${tokens.transitions.fast},
		filter ${tokens.transitions.fast};

	&:hover {
		filter: brightness(1.06);
	}
	&:active {
		transform: scale(0.98);
	}
	&:focus-visible {
		outline: 2px solid ${tokens.colors.onSurface};
		outline-offset: 2px;
	}
`;

const SecurityBadge = styled.div`
	display: inline-flex;
	align-items: center;
	justify-content: center;
	align-self: center;
	gap: 0.4rem;
	padding: 0.3rem 0.75rem;
	border-radius: ${tokens.borderRadius.circle};
	background: ${tokens.colors.surfaceContainerLow};
	border: 1px solid ${tokens.colors.outlineVariant};
`;

const BadgeLabel = styled.span`
	font-family: ${tokens.typography.fontFamily.mono};
	font-size: 11px;
	text-transform: uppercase;
	letter-spacing: 0.08em;
	color: ${tokens.colors.secondary};
	font-weight: ${tokens.typography.fontWeight.semibold};
`;

const SceneWrap = styled.div`
	width: 100%;
	display: flex;
	justify-content: center;
	animation: ${fadeUp} 0.45s cubic-bezier(0.16, 1, 0.3, 1) 0.05s both;
`;

const HeroArt = styled(MountainScene)`
	max-width: 24rem;
	box-shadow: 0 1px 0 ${alpha(tokens.colors.primary, "22")};
`;

/* ── Component ── */

export function SplashScreen() {
	const navigate = useNavigate();
	const { loadModel, updateSettings } = useAppContext();
	const [ready, setReady] = useState(false);

	useEffect(() => {
		let cancelled = false;

		(async () => {
			try {
				const [models, settings] = await Promise.all([
					modelService.getDownloadedModels(),
					settingsService.getSettings(),
					notificationService.init(),
				]);
				if (cancelled) return;

				if (models.length > 0) {
					const target = models.find((m) => m.id === settings.last_model_id) ?? models[0];
					void loadModel(target.id).catch(() => {});
					navigate("/chat", { replace: true });
					return;
				}

				// No model yet. Someone who already saw the walkthrough goes
				// straight to the store instead of sitting through it again.
				if (settings.onboarding_done) {
					navigate("/store", { replace: true });
					return;
				}
			} catch {
				// First launch or a backend error: fall through to the welcome screen.
			}

			if (!cancelled) setReady(true);
		})();

		return () => {
			cancelled = true;
		};
	}, [navigate, loadModel]);

	if (!ready) return <BootScreen />;

	return (
		<Container data-testid="splash-screen" data-tauri-drag-region>
			<HeroSection>
				<LogoBlock>
					<LogoRow>
						<NeurixLogo size={44} />
						<BrandName>
							NEU<span>RIX</span>
						</BrandName>
					</LogoRow>
					<Eyebrow>Sovereign Local Intelligence</Eyebrow>
				</LogoBlock>

				<SceneWrap>
					<HeroArt />
				</SceneWrap>

				<TextBlock>
					<Headline>
						Your AI. Your device. <AccentText>No cloud.</AccentText>
					</Headline>
					<Subtitle>
						Download a GGUF model once, then reason, write, and code anywhere —
						at high altitude, in flight, or completely off-grid.
					</Subtitle>
				</TextBlock>
			</HeroSection>

			<Footer>
				<GetStartedButton
					type="button"
					onClick={() => navigate("/onboarding")}
					data-testid="get-started-button"
				>
					Get started
					<Icon name="arrow_forward" size={18} />
				</GetStartedButton>
				<SkipLink
					type="button"
					onClick={() => {
						updateSettings({ onboarding_done: true }).catch(() => {});
						navigate("/store");
					}}
				>
					Browse all models
				</SkipLink>
				<SecurityBadge>
					<Icon
						name="verified_user"
						size={13}
						fill
						color={tokens.colors.secondary}
					/>
					<BadgeLabel>100% Private · Zero Account · Offline</BadgeLabel>
				</SecurityBadge>
			</Footer>
		</Container>
	);
}

const SkipLink = styled.button`
  border: none;
  background: transparent;
  color: ${tokens.colors.onSurfaceVariant};
  font-size: ${tokens.typography.fontSize.sm};
  font-weight: ${tokens.typography.fontWeight.medium};
  padding: 0.5rem;
  cursor: pointer;
  align-self: center;

  &:hover { color: ${tokens.colors.onSurface}; }
`;
