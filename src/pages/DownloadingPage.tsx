import { AppLayout } from "@/components/layout/AppLayout";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Icon } from "@/components/ui/Icon";
import { useDownloads } from "@/context/DownloadContext";
import type { ModelInfo } from "@/services/types";
import { tokens } from "@/theme/tokens";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import styled, { keyframes } from "styled-components";

const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

const fillIn = keyframes`
  from { width: 0%; }
`;

const Page = styled.div`
  padding: 1.5rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
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
  background: linear-gradient(
    90deg,
    ${tokens.colors.primary} 0%,
    ${tokens.colors.primaryContainer} 40%,
    ${tokens.colors.surfaceBright} 50%,
    ${tokens.colors.primaryContainer} 60%,
    ${tokens.colors.primary} 100%
  );
  background-size: 200% 100%;
  animation: ${fillIn} 0.8s ease-out both, ${shimmer} 1.8s ease-in-out 0.8s infinite;
  transition: width 0.3s ease;
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

const springIn = keyframes`
  0% { transform: scale(0); opacity: 0; }
  60% { transform: scale(1.2); }
  80% { transform: scale(0.95); }
  100% { transform: scale(1); opacity: 1; }
`;

const SuccessBlock = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
`;

const SuccessCircle = styled.div`
  width: 56px;
  height: 56px;
  border-radius: ${tokens.borderRadius.circle};
  background: ${tokens.colors.secondary}18;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: ${springIn} 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
`;

const ActionRow = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const ActionBtn = styled.button<{ $variant?: "danger" | "primary" }>`
  flex: 1;
  padding: 0.75rem;
  border-radius: ${tokens.borderRadius.md};
  font-size: ${tokens.typography.fontSize.sm};
  font-weight: ${tokens.typography.fontWeight.bold};
  text-transform: uppercase;
  letter-spacing: ${tokens.typography.letterSpacing.wider};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: all ${tokens.transitions.fast};

  ${({ $variant }) =>
		$variant === "danger"
			? `
    background: transparent;
    border: 1px solid ${tokens.colors.error}33;
    color: ${tokens.colors.error};
    &:hover { background: ${tokens.colors.error}0d; }
  `
			: $variant === "primary"
				? `
    background: linear-gradient(135deg, ${tokens.colors.primary}, ${tokens.colors.primaryContainer});
    border: none;
    color: ${tokens.colors.onPrimaryFixed};
  `
				: `
    background: ${tokens.colors.surfaceContainerHighest};
    border: none;
    color: ${tokens.colors.onSurface};
    &:hover { background: ${tokens.colors.surfaceBright}; }
  `}

  &:active { transform: scale(0.98); }
`;

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatSpeed(bps: number): string {
	if (bps <= 0) return "--";
	if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KB/s`;
	return `${(bps / (1024 * 1024)).toFixed(1)} MB/s`;
}

function formatEta(bytesRemaining: number, speedBps: number): string {
	if (speedBps <= 0) return "--";
	const seconds = bytesRemaining / speedBps;
	if (seconds < 60) return `${Math.ceil(seconds)}s`;
	if (seconds < 3600) return `${Math.ceil(seconds / 60)} min`;
	return `${(seconds / 3600).toFixed(1)} hr`;
}

export function DownloadingPage() {
	const navigate = useNavigate();
	const location = useLocation();
	const { showConfirm } = useConfirm();
	const model = (location.state as { model?: ModelInfo })?.model;
	const { downloads, pauseDownload, resumeDownload, cancelDownload, removeDownload } = useDownloads();

	const dl = model ? downloads[model.id] : undefined;

	// Auto-redirect on finish
	useEffect(() => {
		if (dl?.status === "finished") {
			if (navigator.vibrate) navigator.vibrate([10, 50, 10]);
			const timer = setTimeout(() => {
				removeDownload(dl.modelId);
				navigate("/models");
			}, 1500);
			return () => clearTimeout(timer);
		}
	}, [dl, navigate, removeDownload]);

	if (!model) {
		navigate("/store");
		return null;
	}

	const totalBytes = dl?.totalBytes || model.size_bytes;
	const downloaded = dl?.downloadedBytes || 0;
	const speed = dl?.speedBps || 0;
	const status = dl?.status || "downloading";
	const pct = totalBytes > 0 ? (downloaded / totalBytes) * 100 : 0;

	const handlePause = () => pauseDownload(model.id);
	const handleResume = () => resumeDownload(model);
	const handleCancel = async () => {
		const ok = await showConfirm({
			title: "Cancel Download",
			message: `Cancel downloading ${model.name}? Your progress will be lost.`,
			confirmLabel: "Cancel Download",
			cancelLabel: "Keep Downloading",
			danger: true,
		});
		if (!ok) return;
		cancelDownload(model.id);
		navigate("/store");
	};

	return (
		<AppLayout title="Downloading">
			<Page>
				<Header>
					<ModelName>{model.name} · {model.size_label}</ModelName>
					<Title>
						{status === "finished"
							? "Download Complete"
							: status === "failed"
								? "Download Failed"
								: status === "paused"
									? "Download Paused"
									: "Downloading Model"}
					</Title>
				</Header>

				<ProgressSection>
					<StatsRow>
						<div>
							<StatLabel>Speed</StatLabel>
							<br />
							<PrimaryValue>{formatSpeed(speed)}</PrimaryValue>
						</div>
						<div style={{ textAlign: "right" }}>
							<StatLabel>Remaining</StatLabel>
							<br />
							<StatValue>
								{formatEta(totalBytes - downloaded, speed)}
							</StatValue>
						</div>
					</StatsRow>

					<BarTrack>
						<BarFill $pct={pct} />
					</BarTrack>

					<BarInfo>
						<BarText>
							{formatBytes(downloaded)} / {formatBytes(totalBytes)}
						</BarText>
						<BarPct>{pct.toFixed(1)}%</BarPct>
					</BarInfo>
				</ProgressSection>

				{status === "failed" && dl?.error && (
					<Hint style={{ color: tokens.colors.error }}>{dl.error}</Hint>
				)}

				{status === "downloading" && (
					<Hint>
						You can leave this screen. The download will continue in the background.
					</Hint>
				)}

				{status === "paused" && (
					<Hint>
						Download paused. Your progress is saved and will resume from where it left off.
					</Hint>
				)}

				{status === "finished" && (
					<SuccessBlock>
						<SuccessCircle>
							<Icon name="check" size={28} color={tokens.colors.secondary} />
						</SuccessCircle>
						<Hint style={{ color: tokens.colors.secondary }}>
							Model ready! Redirecting to My Models...
						</Hint>
					</SuccessBlock>
				)}

				{status === "downloading" && (
					<ActionRow>
						<ActionBtn onClick={handlePause}>
							<Icon name="pause" size={16} />
							Pause
						</ActionBtn>
						<ActionBtn $variant="danger" onClick={handleCancel}>
							Cancel
						</ActionBtn>
					</ActionRow>
				)}

				{status === "paused" && (
					<ActionRow>
						<ActionBtn $variant="primary" onClick={handleResume}>
							<Icon name="play_arrow" size={16} />
							Resume
						</ActionBtn>
						<ActionBtn $variant="danger" onClick={handleCancel}>
							Cancel
						</ActionBtn>
					</ActionRow>
				)}

				{status === "failed" && (
					<ActionRow>
						<ActionBtn $variant="primary" onClick={handleResume}>
							Retry
						</ActionBtn>
						<ActionBtn onClick={() => navigate("/store")}>
							Back to Store
						</ActionBtn>
					</ActionRow>
				)}
			</Page>
		</AppLayout>
	);
}
