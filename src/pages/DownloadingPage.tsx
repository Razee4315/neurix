import { AppLayout } from "@/components/layout/AppLayout";
import { tokens } from "@/theme/tokens";
import { useNavigate } from "react-router-dom";
import styled, { keyframes } from "styled-components";

const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

const Page = styled.div`
  padding: 1.5rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const Header = styled.div``;

const ModelName = styled.span`
  font-size: ${tokens.typography.fontSize.base};
  color: ${tokens.colors.onSurfaceVariant};
`;

const Title = styled.h1`
  font-family: ${tokens.typography.fontFamily.headline};
  font-size: clamp(1.5rem, 6vw, 2rem);
  font-weight: ${tokens.typography.fontWeight.bold};
  color: ${tokens.colors.onSurface};
  margin-top: 0.25rem;
`;

const ProgressSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const StatsRow = styled.div`
  display: flex;
  justify-content: space-between;
`;

const StatLabel = styled.span`
  font-size: ${tokens.typography.fontSize.sm};
  color: ${tokens.colors.onSurfaceVariant};
`;

const StatValue = styled.span`
  font-family: ${tokens.typography.fontFamily.headline};
  font-size: ${tokens.typography.fontSize.xl};
  font-weight: ${tokens.typography.fontWeight.bold};
  color: ${tokens.colors.onSurface};
`;

const PrimaryValue = styled(StatValue)`
  color: ${tokens.colors.primary};
`;

const BarTrack = styled.div`
  width: 100%;
  height: 8px;
  background: ${tokens.colors.surfaceContainerHighest};
  border-radius: ${tokens.borderRadius.circle};
  overflow: hidden;
`;

const BarFill = styled.div<{ $pct: number }>`
  height: 100%;
  width: ${({ $pct }) => $pct}%;
  border-radius: ${tokens.borderRadius.circle};
  background: linear-gradient(90deg, ${tokens.colors.primary}, ${tokens.colors.primaryContainer});
  background-size: 200% 100%;
  animation: ${shimmer} 2s ease-in-out infinite;
`;

const BarInfo = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: ${tokens.typography.fontSize.sm};
`;

const BarText = styled.span`
  color: ${tokens.colors.onSurfaceVariant};
`;

const BarPct = styled.span`
  color: ${tokens.colors.primary};
  font-weight: ${tokens.typography.fontWeight.bold};
`;

const Hint = styled.p`
  font-size: ${tokens.typography.fontSize.base};
  color: ${tokens.colors.onSurfaceVariant};
  line-height: ${tokens.typography.lineHeight.relaxed};
`;

const CancelBtn = styled.button`
  width: 100%;
  padding: 0.75rem;
  border-radius: ${tokens.borderRadius.md};
  background: transparent;
  border: 1px solid ${tokens.colors.error}33;
  color: ${tokens.colors.error};
  font-size: ${tokens.typography.fontSize.sm};
  font-weight: ${tokens.typography.fontWeight.bold};
  text-transform: uppercase;
  letter-spacing: ${tokens.typography.letterSpacing.wider};
  cursor: pointer;

  &:active {
    background: ${tokens.colors.error}0d;
  }
`;

export function DownloadingPage() {
	const navigate = useNavigate();

	return (
		<AppLayout>
			<Page>
				<Header>
					<ModelName>Llama 3 8B · v1.0.4</ModelName>
					<Title>Downloading Model</Title>
				</Header>

				<ProgressSection>
					<StatsRow>
						<div>
							<StatLabel>Speed</StatLabel>
							<br />
							<PrimaryValue>12.4 MB/s</PrimaryValue>
						</div>
						<div style={{ textAlign: "right" }}>
							<StatLabel>Remaining</StatLabel>
							<br />
							<StatValue>2 min</StatValue>
						</div>
					</StatsRow>

					<BarTrack>
						<BarFill $pct={37.5} />
					</BarTrack>

					<BarInfo>
						<BarText>450 MB / 1.2 GB</BarText>
						<BarPct>37.5%</BarPct>
					</BarInfo>
				</ProgressSection>

				<Hint>
					You can leave this screen. The download will continue in the
					background.
				</Hint>

				<CancelBtn onClick={() => navigate("/store")}>
					Cancel Download
				</CancelBtn>
			</Page>
		</AppLayout>
	);
}
