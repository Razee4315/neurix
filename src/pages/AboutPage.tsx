import { AppLayout } from "@/components/layout/AppLayout";
import { Icon } from "@/components/ui/Icon";
import { NeurixLogo } from "@/components/ui/NeurixLogo";
import { tokens } from "@/theme/tokens";
import { openUrl as tauriOpenUrl } from "@tauri-apps/plugin-opener";
import styled, { keyframes } from "styled-components";

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
`;

const Page = styled.div`
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  animation: ${fadeIn} 0.4s ease-out both;
`;

const LogoSection = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1rem;
`;

const AppName = styled.h1`
  font-family: ${tokens.typography.fontFamily.headline};
  font-size: ${tokens.typography.fontSize["3xl"]};
  font-weight: ${tokens.typography.fontWeight.bold};
  color: ${tokens.colors.onSurface};
  letter-spacing: ${tokens.typography.letterSpacing.tighter};

  span { color: ${tokens.colors.primary}; }
`;

const Version = styled.span`
  font-size: ${tokens.typography.fontSize.sm};
  color: ${tokens.colors.onSurfaceVariant};
`;

const Tagline = styled.p`
  font-size: ${tokens.typography.fontSize.base};
  color: ${tokens.colors.onSurfaceVariant};
  text-align: center;
  line-height: ${tokens.typography.lineHeight.relaxed};
  max-width: 300px;
`;

const Section = styled.div`
  width: 100%;
  background: ${tokens.colors.surfaceContainerLow};
  border-radius: ${tokens.borderRadius.lg};
  overflow: hidden;
`;

const SectionTitle = styled.h2`
  font-size: ${tokens.typography.fontSize.sm};
  text-transform: uppercase;
  letter-spacing: ${tokens.typography.letterSpacing.wide};
  color: ${tokens.colors.onSurfaceVariant};
  margin-bottom: 0.5rem;
  padding-left: 0.25rem;
`;

const LinkRow = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background ${tokens.transitions.fast};
  min-height: 48px;

  &:hover { background: ${tokens.colors.surfaceContainerHigh}; }
  &:active { transform: scale(0.99); }
`;

const LinkIcon = styled.div`
  width: 36px;
  height: 36px;
  border-radius: ${tokens.borderRadius.md};
  background: ${tokens.colors.surfaceContainerHighest};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

const LinkText = styled.div`
  flex: 1;
  text-align: left;
`;

const LinkTitle = styled.div`
  font-size: ${tokens.typography.fontSize.base};
  font-weight: ${tokens.typography.fontWeight.medium};
  color: ${tokens.colors.onSurface};
`;

const LinkSub = styled.div`
  font-size: ${tokens.typography.fontSize.sm};
  color: ${tokens.colors.onSurfaceVariant};
`;

const Footer = styled.div`
  font-size: ${tokens.typography.fontSize.sm};
  color: ${tokens.colors.outline};
  text-align: center;
  padding-bottom: 1rem;
`;

export function AboutPage() {
	const openLink = (url: string) => {
		tauriOpenUrl(url).catch(() => window.open(url, "_blank"));
	};

	return (
		<AppLayout title="About">
			<Page>
				<LogoSection>
					<NeurixLogo size={64} />
					<AppName>NEU<span>RIX</span></AppName>
					<Version>v{import.meta.env.VITE_APP_VERSION || "0.3.0"}</Version>
				</LogoSection>

				<Tagline>
					Run powerful AI models directly on your device.
					Fully offline. Completely private.
				</Tagline>

				<SectionTitle>Links</SectionTitle>
				<Section>
					<LinkRow onClick={() => openLink("https://github.com/Razee4315/neurix")}>
						<LinkIcon>
							<Icon name="deployed_code" size={18} color={tokens.colors.primary} />
						</LinkIcon>
						<LinkText>
							<LinkTitle>Source Code</LinkTitle>
							<LinkSub>Open source on GitHub</LinkSub>
						</LinkText>
						<Icon name="open_in_new" size={16} color={tokens.colors.onSurfaceVariant} />
					</LinkRow>
					<LinkRow onClick={() => openLink("https://github.com/Razee4315/neurix/blob/main/PRIVACY_POLICY.md")}>
						<LinkIcon>
							<Icon name="shield" size={18} color={tokens.colors.primary} />
						</LinkIcon>
						<LinkText>
							<LinkTitle>Privacy Policy</LinkTitle>
							<LinkSub>No data collected, ever</LinkSub>
						</LinkText>
						<Icon name="open_in_new" size={16} color={tokens.colors.onSurfaceVariant} />
					</LinkRow>
				</Section>

				<Footer>
					Made by Saqlain Abbas
				</Footer>
			</Page>
		</AppLayout>
	);
}
