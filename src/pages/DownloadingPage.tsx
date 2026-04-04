import { AppLayout } from "@/components/layout/AppLayout";
import { modelService } from "@/services";
import type { DownloadEvent, ModelInfo } from "@/services/types";
import { tokens } from "@/theme/tokens";
import { useCallback, useEffect, useRef, useState } from "react";
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
  animation: ${fillIn} 0.8s ease-out both, ${shimmer} 2s ease-in-out 0.8s infinite;
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

  &:hover { background: ${tokens.colors.error}0d; }
  &:active { transform: scale(0.98); }
`;

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatSpeed(bps: number): string {
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
	const model = (location.state as { model?: ModelInfo })?.model;

	const [totalBytes, setTotalBytes] = useState(0);
	const [downloaded, setDownloaded] = useState(0);
	const [speed, setSpeed] = useState(0);
	const [status, setStatus] = useState<"idle" | "downloading" | "finished" | "failed" | "cancelled">("idle");
	const [error, setError] = useState("");
	const startedRef = useRef(false);

	const pct = totalBytes > 0 ? (downloaded / totalBytes) * 100 : 0;

	const handleEvent = useCallback((event: DownloadEvent) => {
		switch (event.event) {
			case "Started":
				if (event.data && "total_bytes" in event.data) {
					setTotalBytes(event.data.total_bytes);
				}
				setStatus("downloading");
				break;
			case "Progress":
				if (event.data && "bytes_downloaded" in event.data) {
					setDownloaded(event.data.bytes_downloaded);
					setTotalBytes(event.data.total_bytes);
					setSpeed(event.data.speed_bps);
				}
				break;
			case "Finished":
				setStatus("finished");
				break;
			case "Failed":
				setStatus("failed");
				if (event.data && "error" in event.data) {
					setError(event.data.error);
				}
				break;
			case "Cancelled":
				setStatus("cancelled");
				break;
		}
	}, []);

	useEffect(() => {
		if (!model || startedRef.current) return;
		startedRef.current = true;
		setStatus("downloading");
		modelService.downloadModel(model.id, handleEvent).catch((err) => {
			setStatus("failed");
			setError(String(err));
		});
	}, [model, handleEvent]);

	useEffect(() => {
		if (status === "finished") {
			const timer = setTimeout(() => navigate("/models"), 1000);
			return () => clearTimeout(timer);
		}
		if (status === "cancelled") {
			const timer = setTimeout(() => navigate("/store"), 500);
			return () => clearTimeout(timer);
		}
	}, [status, navigate]);

	const handleCancel = () => {
		if (model) {
			modelService.cancelDownload(model.id);
		}
	};

	if (!model) {
		navigate("/store");
		return null;
	}

	return (
		<AppLayout>
			<Page>
				<Header>
					<ModelName>{model.name} · {model.size_label}</ModelName>
					<Title>
						{status === "finished"
							? "Download Complete"
							: status === "failed"
								? "Download Failed"
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

				{status === "failed" && error && (
					<Hint style={{ color: tokens.colors.error }}>{error}</Hint>
				)}

				{status === "downloading" && (
					<Hint>
						You can leave this screen. The download will continue in the
						background.
					</Hint>
				)}

				{status === "finished" && (
					<Hint style={{ color: tokens.colors.secondary }}>
						Model ready! Redirecting to My Models...
					</Hint>
				)}

				{status === "downloading" && (
					<CancelBtn onClick={handleCancel}>Cancel Download</CancelBtn>
				)}

				{status === "failed" && (
					<CancelBtn onClick={() => navigate("/store")}>
						Back to Store
					</CancelBtn>
				)}
			</Page>
		</AppLayout>
	);
}
