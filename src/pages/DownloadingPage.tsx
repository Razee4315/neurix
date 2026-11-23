import { AppLayout } from "@/components/layout/AppLayout";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Icon } from "@/components/ui/Icon";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { useAppContext } from "@/context/AppContext";
import { useDownloads } from "@/context/DownloadContext";
import { canDownloadInBackground } from "@/services/androidBridge";
import type { ModelInfo } from "@/services/types";
import { alpha } from "@/theme/alpha";
import { tokens } from "@/theme/tokens";
import { HANDOFF_DELAY_MS, handoffTarget } from "@/utils/downloadHandoff";
import { formatBytes, formatEta, formatSpeed } from "@/utils/format";
import { isMobile, vibrate } from "@/utils/platform";
import { useCatalogModel } from "@/utils/useCatalogModel";
import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import styled, { keyframes } from "styled-components";

const fillIn = keyframes`
  from { width: 0%; }
`;

const Page = styled.div`
  max-width: 44rem;
  margin: 0 auto;
  padding: 1.5rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
`;

const Header = styled.div`
	display: flex;
	flex-direction: column;
	gap: 0.25rem;
`;

const ModelMetaRow = styled.div`
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 0.5rem;
`;

const ModelName = styled.span`
	font-size: ${tokens.typography.fontSize.base};
	font-weight: ${tokens.typography.fontWeight.medium};
	color: ${tokens.colors.onSurfaceVariant};
`;

const QuantPill = styled.span`
	font-family: ${tokens.typography.fontFamily.mono};
	font-size: 11px;
	padding: 0.15rem 0.5rem;
	border-radius: ${tokens.borderRadius.sm};
	background: ${tokens.colors.surfaceContainerHigh};
	color: ${tokens.colors.onSurfaceVariant};
`;

const Title = styled.h1`
	font-family: ${tokens.typography.fontFamily.headline};
	font-size: clamp(1.5rem, 6vw, 2rem);
	font-weight: ${tokens.typography.fontWeight.bold};
	color: ${tokens.colors.onSurface};
	margin-top: 0.125rem;
`;

const ProgressCard = styled.div`
	display: flex;
	flex-direction: column;
	gap: 0.875rem;
	padding: 1.125rem;
	border-radius: ${tokens.borderRadius.xl};
	background: ${tokens.colors.surfaceContainerLow};
	border: 1px solid ${tokens.colors.outlineVariant};
`;

const StatsRow = styled.div`
	display: flex;
	justify-content: space-between;
	align-items: flex-end;
	gap: 1rem;
`;

const StatLabel = styled.span`
	font-size: ${tokens.typography.fontSize.xs};
	text-transform: uppercase;
	letter-spacing: 0.08em;
	font-weight: ${tokens.typography.fontWeight.semibold};
	color: ${tokens.colors.onSurfaceVariant};
`;

const StatValue = styled.span`
	font-family: ${tokens.typography.fontFamily.mono};
	font-variant-numeric: tabular-nums;
	font-size: ${tokens.typography.fontSize.xl};
	font-weight: ${tokens.typography.fontWeight.bold};
	color: ${tokens.colors.onSurface};
`;

const PrimaryValue = styled(StatValue)`
	color: ${tokens.colors.secondary};
`;

const BarTrack = styled.div`
	width: 100%;
	height: 10px;
	background: ${tokens.colors.surfaceContainerHighest};
	border-radius: ${tokens.borderRadius.circle};
	overflow: hidden;
`;

const BarFill = styled.div<{ $pct: number }>`
	height: 100%;
	width: ${({ $pct }) => $pct}%;
	border-radius: ${tokens.borderRadius.circle};
	background: ${tokens.colors.primary};
	animation: ${fillIn} 0.8s ease-out both;
	transition: width 0.36s ease-out;
`;

const BarInfo = styled.div`
	display: flex;
	justify-content: space-between;
	align-items: center;
	font-family: ${tokens.typography.fontFamily.mono};
	font-variant-numeric: tabular-nums;
	font-size: ${tokens.typography.fontSize.sm};
`;

const BarText = styled.span`
	color: ${tokens.colors.onSurfaceVariant};
`;

const BarPct = styled.span`
	color: ${tokens.colors.primary};
	font-weight: ${tokens.typography.fontWeight.bold};
`;

const DestinationRow = styled.div`
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	justify-content: space-between;
	gap: 0.5rem 1rem;
	padding-top: 0.75rem;
	border-top: 1px solid ${tokens.colors.outlineVariant};
	font-size: ${tokens.typography.fontSize.xs};
	color: ${tokens.colors.onSurfaceVariant};
`;

const DestinationPath = styled.span`
	display: inline-flex;
	align-items: center;
	gap: 0.375rem;
	font-family: ${tokens.typography.fontFamily.mono};
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
`;

const ChecksumBadge = styled.span<{ $active: boolean }>`
	display: inline-flex;
	align-items: center;
	gap: 0.3rem;
	font-family: ${tokens.typography.fontFamily.mono};
	color: ${({ $active }) =>
		$active ? tokens.colors.secondary : tokens.colors.onSurfaceVariant};
	font-weight: ${({ $active }) =>
		$active
			? tokens.typography.fontWeight.semibold
			: tokens.typography.fontWeight.regular};
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
  background: ${alpha(tokens.colors.secondary, "18")};
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
    border: 1px solid ${alpha(tokens.colors.error, "33")};
    color: ${tokens.colors.error};
    &:hover { background: ${alpha(tokens.colors.error, "0d")}; }
  `
			: $variant === "primary"
				? `
    background: ${tokens.colors.primary};
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

const Reason = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  padding: 0.75rem 0.875rem;
  border-radius: ${tokens.borderRadius.xl};
  background: ${alpha(tokens.colors.error, "14")};
  border: 1px solid ${alpha(tokens.colors.error, "40")};
  color: ${tokens.colors.onSurface};
  font-size: ${tokens.typography.fontSize.sm};
  line-height: ${tokens.typography.lineHeight.relaxed};
  text-align: left;

  svg { margin-top: 2px; }
`;

const TITLES = {
	idle: "Not downloading",
	downloading: "Downloading model",
	verifying: "Checking the download",
	paused: "Download paused",
	failed: "Download failed",
	finished: "Download complete",
} as const;

export function DownloadingPage() {
	const navigate = useNavigate();
	const location = useLocation();
	const { showConfirm } = useConfirm();
	const { activeModelId, loadModel } = useAppContext();
	const stateModel = (location.state as { model?: ModelInfo } | null)?.model;
	const idFromQuery = new URLSearchParams(location.search).get("id");
	const { model, lookupFailed } = useCatalogModel(stateModel, idFromQuery);
	const { downloads, startDownload, pauseDownload, resumeDownload, cancelDownload, removeDownload } =
		useDownloads();

	const dl = model ? downloads[model.id] : undefined;
	const [opening, setOpening] = useState(false);
	const finishedHandled = useRef(false);
	const handoffTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const mounted = useRef(true);

	// Leaving the page cancels the hand-off: it must not pull the user back
	// from wherever they went.
	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
			if (handoffTimer.current) clearTimeout(handoffTimer.current);
		};
	}, []);

	// When the download finishes: on a first install (nothing loaded yet)
	// load the model and go straight to chat; otherwise show it in My Models
	// without switching away from the model the user is already using.
	useEffect(() => {
		if (dl?.status !== "finished" || !model || finishedHandled.current) return;
		finishedHandled.current = true;
		vibrate([10, 50, 10]);
		const modelId = model.id;
		const target = handoffTarget(activeModelId);
		// Not cleared when this effect re-runs on purpose: `finishedHandled`
		// guarantees it is scheduled once, and it has to survive the state
		// updates it causes. Only leaving the page cancels it (above).
		handoffTimer.current = setTimeout(async () => {
			handoffTimer.current = null;
			removeDownload(modelId);
			if (target === "models") {
				navigate("/models");
				return;
			}
			setOpening(true);
			try {
				await loadModel(modelId);
				if (mounted.current) navigate("/chat", { state: { freshChat: true } });
			} catch {
				if (mounted.current) navigate("/models");
			}
		}, HANDOFF_DELAY_MS);
	}, [dl?.status, model, activeModelId, loadModel, navigate, removeDownload]);

	if (!model) {
		if (!idFromQuery || lookupFailed) return <Navigate to="/store" replace />;
		return (
			<AppLayout title="Download" back="/store">
				<Page aria-busy="true" />
			</AppLayout>
		);
	}

	if (opening) {
		return <LoadingOverlay title={`Loading ${model.name}`} subtitle="Getting your first chat ready…" />;
	}

	const status = dl?.status ?? "idle";
	const totalBytes = dl?.totalBytes || model.size_bytes;
	const downloaded = dl?.downloadedBytes ?? 0;
	const speed = dl?.speedBps ?? 0;
	const pct = totalBytes > 0 ? Math.min(100, (downloaded / totalBytes) * 100) : 0;

	const handleCancel = async () => {
		const ok = await showConfirm({
			title: "Cancel download",
			message:
				downloaded > 0
					? `Stop downloading ${model.name} and delete the ${formatBytes(downloaded)} downloaded so far? To keep your progress, pause instead.`
					: `Stop downloading ${model.name}?`,
			confirmLabel: "Cancel download",
			cancelLabel: "Keep it",
			danger: true,
		});
		if (!ok) return;
		cancelDownload(model.id);
		navigate("/store");
	};

	return (
		<AppLayout title="Download" back="/store">
			<Page>
				<Header>
					<ModelMetaRow>
						<ModelName>
							{model.name} · {model.size_label}
						</ModelName>
						<QuantPill>{model.quantization}</QuantPill>
					</ModelMetaRow>
					<Title>{TITLES[status]}</Title>
				</Header>

				<ProgressCard>
					<StatsRow>
						<div>
							<StatLabel>Speed</StatLabel>
							<br />
							<PrimaryValue>
								{status === "downloading" ? formatSpeed(speed) : "--"}
							</PrimaryValue>
						</div>
						<div style={{ textAlign: "right" }}>
							<StatLabel>Remaining</StatLabel>
							<br />
							<StatValue>
								{status === "downloading"
									? formatEta(totalBytes - downloaded, speed)
									: "--"}
							</StatValue>
						</div>
					</StatsRow>

					<BarTrack
						role="progressbar"
						aria-label={`${model.name} download`}
						aria-valuemin={0}
						aria-valuemax={100}
						aria-valuenow={Math.round(pct)}
					>
						<BarFill $pct={pct} />
					</BarTrack>

					<BarInfo>
						<BarText>
							{formatBytes(downloaded)} / {formatBytes(totalBytes)}
						</BarText>
						<BarPct>{pct.toFixed(1)}%</BarPct>
					</BarInfo>

					<DestinationRow>
						<DestinationPath title={`${model.hf_repo}/${model.hf_filename}`}>
							<Icon name="storage" size={13} color={tokens.colors.primary} />
							models/{model.id}/{model.hf_filename}
						</DestinationPath>
						<ChecksumBadge
							$active={status === "verifying" || status === "finished"}
						>
							<Icon
								name={
									status === "finished" ? "check_circle" : "verified_user"
								}
								size={13}
							/>
							{status === "verifying"
								? "Verifying SHA-256…"
								: status === "finished"
									? "SHA-256 verified"
									: "SHA-256 integrity check"}
						</ChecksumBadge>
					</DestinationRow>
				</ProgressCard>

				{(status === "failed" || status === "paused") && dl?.error && (
					<Reason role="alert">
						<Icon
							name={dl.blockedByWifi ? "wifi" : "error_outline"}
							size={16}
							color={tokens.colors.error}
						/>
						<span>
							{dl.error}
							{dl.blockedByWifi &&
								` This download is ${model.size_label}. Connect to WiFi, or go ahead on this connection.`}
						</span>
					</Reason>
				)}

				{status === "idle" && (
					<Hint>This model isn't downloading right now.</Hint>
				)}

				{status === "downloading" && (
					<Hint>
						{canDownloadInBackground()
							? "You can switch apps or lock the screen: the download carries on in the background. Closing Neurix from recent apps pauses it, and it resumes from where it stopped."
							: isMobile()
								? "Keep Neurix open until this finishes. If it's interrupted, it resumes from where it stopped."
								: "You can keep using Neurix while this downloads. Closing the app pauses it."}
					</Hint>
				)}

				{status === "verifying" && <Hint>Making sure the file arrived intact…</Hint>}

				{status === "paused" && !dl?.error && (
					<Hint>Your progress is saved. Resume to continue from where it stopped.</Hint>
				)}

				{status === "finished" && (
					<SuccessBlock>
						<SuccessCircle>
							<Icon name="check" size={28} color={tokens.colors.secondary} />
						</SuccessCircle>
						<Hint style={{ color: tokens.colors.secondary }}>
							{activeModelId ? "Model ready. Opening My Models…" : "Model ready. Opening your first chat…"}
						</Hint>
					</SuccessBlock>
				)}

				{status === "idle" && (
					<ActionRow>
						<ActionBtn type="button" $variant="primary" onClick={() => startDownload(model)}>
							<Icon name="download" size={16} />
							Start download
						</ActionBtn>
						<ActionBtn type="button" onClick={() => navigate("/store")}>
							Back to Store
						</ActionBtn>
					</ActionRow>
				)}

				{status === "downloading" && (
					<ActionRow>
						<ActionBtn type="button" onClick={() => pauseDownload(model.id)}>
							<Icon name="pause" size={16} />
							Pause
						</ActionBtn>
						<ActionBtn type="button" $variant="danger" onClick={handleCancel}>
							Cancel
						</ActionBtn>
					</ActionRow>
				)}

				{(status === "paused" || status === "failed") && (
					<ActionRow>
						{dl?.blockedByWifi ? (
							<ActionBtn
								type="button"
								$variant="primary"
								onClick={() => resumeDownload(model, { allowMobileData: true })}
							>
								<Icon name="download" size={16} />
								Use this connection
							</ActionBtn>
						) : (
							<ActionBtn type="button" $variant="primary" onClick={() => resumeDownload(model)}>
								<Icon name={status === "failed" ? "refresh" : "play_arrow"} size={16} />
								{status === "failed" ? "Try again" : "Resume"}
							</ActionBtn>
						)}
						<ActionBtn type="button" $variant="danger" onClick={handleCancel}>
							Cancel
						</ActionBtn>
					</ActionRow>
				)}
			</Page>
		</AppLayout>
	);
}
