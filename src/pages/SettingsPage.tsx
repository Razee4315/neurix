import { AppLayout } from "@/components/layout/AppLayout";
import { Icon } from "@/components/ui/Icon";
import { tokens } from "@/theme/tokens";
import { useState } from "react";
import styled from "styled-components";

/* ── Styles ── */

const Page = styled.div`
  padding: 1.25rem;
`;

const Title = styled.h1`
  font-family: ${tokens.typography.fontFamily.headline};
  font-size: clamp(1.75rem, 6vw, 2.25rem);
  font-weight: ${tokens.typography.fontWeight.bold};
  color: ${tokens.colors.onSurface};
  margin-bottom: 1.5rem;
`;

/* ── Toggle Rows ── */

const Section = styled.div`
  background: ${tokens.colors.surfaceContainerLow};
  border-radius: ${tokens.borderRadius.lg};
  margin-bottom: 1rem;
  overflow: hidden;
`;

const ToggleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1rem;
  gap: 0.75rem;
`;

const RowLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
  min-width: 0;
`;

const RowIcon = styled.div`
  width: 36px;
  height: 36px;
  border-radius: ${tokens.borderRadius.md};
  background: ${tokens.colors.surfaceContainerHighest};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

const RowText = styled.div`
  min-width: 0;
`;

const RowTitle = styled.div`
  font-size: ${tokens.typography.fontSize.base};
  font-weight: ${tokens.typography.fontWeight.medium};
  color: ${tokens.colors.onSurface};
`;

const RowSub = styled.div`
  font-size: ${tokens.typography.fontSize.sm};
  color: ${tokens.colors.onSurfaceVariant};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

/* ── Toggle Switch ── */

const Toggle = styled.button<{ $on: boolean }>`
  width: 40px;
  height: 22px;
  border-radius: 11px;
  border: none;
  cursor: pointer;
  position: relative;
  flex-shrink: 0;
  transition: background ${tokens.transitions.fast};
  background: ${({ $on }) =>
		$on ? tokens.colors.primary : tokens.colors.surfaceContainerHighest};

  &::after {
    content: "";
    position: absolute;
    top: 3px;
    left: ${({ $on }) => ($on ? "21px" : "3px")};
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: ${({ $on }) =>
			$on ? tokens.colors.onPrimaryContainer : tokens.colors.outline};
    transition: left ${tokens.transitions.fast};
  }
`;

/* ── System Prompt ── */

const SectionLabel = styled.h2`
  font-size: ${tokens.typography.fontSize.sm};
  text-transform: uppercase;
  letter-spacing: ${tokens.typography.letterSpacing.widest};
  color: ${tokens.colors.onSurfaceVariant};
  margin-bottom: 0.5rem;
  padding-left: 0.25rem;
`;

const PromptArea = styled.textarea`
  width: 100%;
  min-height: 100px;
  padding: 0.875rem;
  background: ${tokens.colors.surfaceContainerHighest};
  border: none;
  border-radius: ${tokens.borderRadius.lg};
  font-size: ${tokens.typography.fontSize.base};
  font-family: ${tokens.typography.fontFamily.body};
  color: ${tokens.colors.onSurface};
  resize: vertical;
  outline: none;
  line-height: ${tokens.typography.lineHeight.relaxed};

  &::placeholder { color: ${tokens.colors.outline}; }
  &:focus { box-shadow: inset 0 -2px 0 ${tokens.colors.primary}; }
`;

/* ── Version ── */

const VersionCard = styled.div`
  background: ${tokens.colors.surfaceContainerLow};
  border-radius: ${tokens.borderRadius.lg};
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1rem;
`;

const VersionInfo = styled.div``;

const VersionNumber = styled.div`
  font-family: ${tokens.typography.fontFamily.headline};
  font-size: ${tokens.typography.fontSize.xl};
  font-weight: ${tokens.typography.fontWeight.bold};
  color: ${tokens.colors.primary};
`;

const VersionSub = styled.div`
  font-size: ${tokens.typography.fontSize.sm};
  color: ${tokens.colors.onSurfaceVariant};
`;

const UpdateBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.75rem;
  background: ${tokens.colors.surfaceContainerHighest};
  border: none;
  border-radius: ${tokens.borderRadius.md};
  font-size: ${tokens.typography.fontSize.sm};
  font-weight: ${tokens.typography.fontWeight.medium};
  color: ${tokens.colors.onSurface};
  cursor: pointer;

  &:active { transform: scale(0.97); }
`;

/* ── Component ── */

export function SettingsPage() {
	const [wifiOnly, setWifiOnly] = useState(false);
	const [saveHistory, setSaveHistory] = useState(true);
	const [showSpeed, setShowSpeed] = useState(true);
	const [prompt, setPrompt] = useState("");

	return (
		<AppLayout>
			<Page>
				<Title>Settings</Title>

				<Section>
					<ToggleRow>
						<RowLeft>
							<RowIcon>
								<Icon name="wifi" size={18} color={tokens.colors.primary} />
							</RowIcon>
							<RowText>
								<RowTitle>WiFi-only downloads</RowTitle>
								<RowSub>Save mobile data</RowSub>
							</RowText>
						</RowLeft>
						<Toggle $on={wifiOnly} onClick={() => setWifiOnly((v) => !v)} />
					</ToggleRow>

					<ToggleRow>
						<RowLeft>
							<RowIcon>
								<Icon name="history" size={18} color={tokens.colors.primary} />
							</RowIcon>
							<RowText>
								<RowTitle>Save chat history</RowTitle>
								<RowSub>Keep conversations locally</RowSub>
							</RowText>
						</RowLeft>
						<Toggle
							$on={saveHistory}
							onClick={() => setSaveHistory((v) => !v)}
						/>
					</ToggleRow>

					<ToggleRow>
						<RowLeft>
							<RowIcon>
								<Icon name="speed" size={18} color={tokens.colors.primary} />
							</RowIcon>
							<RowText>
								<RowTitle>Show token speed</RowTitle>
								<RowSub>Display inference speed in chat</RowSub>
							</RowText>
						</RowLeft>
						<Toggle $on={showSpeed} onClick={() => setShowSpeed((v) => !v)} />
					</ToggleRow>
				</Section>

				<SectionLabel>System Prompt</SectionLabel>
				<PromptArea
					placeholder="Customize how the AI responds..."
					value={prompt}
					onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
						setPrompt(e.target.value)
					}
				/>

				<VersionCard>
					<VersionInfo>
						<VersionNumber>v0.1.0</VersionNumber>
						<VersionSub>Alpha build</VersionSub>
					</VersionInfo>
					<UpdateBtn>
						<Icon name="update" size={16} color={tokens.colors.onSurface} />
						Check updates
					</UpdateBtn>
				</VersionCard>
			</Page>
		</AppLayout>
	);
}
