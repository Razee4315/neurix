import { AppLayout } from "@/components/layout/AppLayout";
import { Icon } from "@/components/ui/Icon";
import { NeurixLogo } from "@/components/ui/NeurixLogo";
import { tokens } from "@/theme/tokens";
import { openUrl as tauriOpenUrl } from "@tauri-apps/plugin-opener";
import styled from "styled-components";

const Page = styled.div`
  max-width: 44rem;
  margin: 0 auto;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const Hero = styled.section`
  display: grid;
  gap: 1rem;
  padding: clamp(1rem, 4vw, 2rem);
  border: 1px solid ${tokens.colors.outlineVariant};
  border-top: 3px solid ${tokens.colors.primary};
  border-radius: ${tokens.borderRadius.lg};
  background: ${tokens.colors.surfaceContainer};
`;

const LogoSection = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`;

const AppName = styled.h1`
  font-family: ${tokens.typography.fontFamily.headline};
  font-size: ${tokens.typography.fontSize["3xl"]};
  font-weight: ${tokens.typography.fontWeight.bold};
  color: ${tokens.colors.onSurface};
  letter-spacing: ${tokens.typography.letterSpacing.tighter};

  line-height: 1.1;
`;

const Version = styled.span`
  font-size: ${tokens.typography.fontSize.sm};
  color: ${tokens.colors.onSurfaceVariant};
`;

const Tagline = styled.p`
  font-size: ${tokens.typography.fontSize.base};
  color: ${tokens.colors.onSurfaceVariant};
  line-height: ${tokens.typography.lineHeight.relaxed};
  max-width: 48ch;
`;

const Stack = styled.ul`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  padding: 0.875rem 0 0;
  margin: 0;
  border-top: 1px solid ${tokens.colors.outlineVariant};
  list-style: none;
  color: ${tokens.colors.primary};
  font-size: ${tokens.typography.fontSize.sm};
  font-family: ${tokens.typography.fontFamily.mono};
`;

const Section = styled.div`
  width: 100%;
  background: ${tokens.colors.surfaceContainerLow};
  border: 1px solid ${tokens.colors.outlineVariant};
  border-radius: ${tokens.borderRadius.lg};
  overflow: hidden;
`;

const SectionTitle = styled.h2`
  font-size: ${tokens.typography.fontSize.sm};
  color: ${tokens.colors.onSurface};
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
  & + & { border-top: 1px solid ${tokens.colors.outlineVariant}; }
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
  color: ${tokens.colors.onSurfaceVariant};
  padding-bottom: 1rem;
`;

export function AboutPage() {
	const openLink = (url: string) => {
		tauriOpenUrl(url).catch(() => window.open(url, "_blank", "noopener,noreferrer"));
	};

	return (
		<AppLayout title="About" back="/settings">
			<Page>
				<Hero aria-label="Neurix Karakoram">
					<LogoSection>
						<NeurixLogo size={64} />
						<div>
							<AppName>Neurix</AppName>
							<Version>Karakoram · v{import.meta.env.VITE_APP_VERSION ?? "dev"}</Version>
						</div>
					</LogoSection>
					<Tagline>
						Run AI models locally and search your connected folders on this device.
						Chat works offline once you have a model.
					</Tagline>
					<Stack aria-label="Engineering highlights">
						{["Tauri 2", "Rust", "llama.cpp", "SQLite FTS5", "Zero Cloud"].map((item) => (
							<li key={item}>{item}</li>
						))}
					</Stack>
				</Hero>

				<section aria-labelledby="about-links">
					<SectionTitle id="about-links">Links</SectionTitle>
					<Section>
						<LinkRow type="button" onClick={() => openLink("https://github.com/Razee4315/neurix")}>
							<LinkIcon>
								<Icon name="github" size={18} color={tokens.colors.primary} />
							</LinkIcon>
							<LinkText>
								<LinkTitle>Source code</LinkTitle>
								<LinkSub>Open source on GitHub</LinkSub>
							</LinkText>
							<Icon name="open_in_new" size={16} color={tokens.colors.onSurfaceVariant} />
						</LinkRow>
						<LinkRow type="button" onClick={() => openLink("https://github.com/Razee4315/neurix/blob/main/PRIVACY_POLICY.md")}>
							<LinkIcon>
								<Icon name="shield" size={18} color={tokens.colors.primary} />
							</LinkIcon>
							<LinkText>
								<LinkTitle>Privacy policy</LinkTitle>
								<LinkSub>Local storage and network use</LinkSub>
							</LinkText>
							<Icon name="open_in_new" size={16} color={tokens.colors.onSurfaceVariant} />
						</LinkRow>
					</Section>
				</section>

				<Footer>
					Made by Saqlain Abbas
				</Footer>
			</Page>
		</AppLayout>
	);
}
