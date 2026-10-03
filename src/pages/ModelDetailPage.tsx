import { AppLayout } from "@/components/layout/AppLayout";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Icon } from "@/components/ui/Icon";
import { OfflineBanner } from "@/components/ui/OfflineBanner";
import { useDownloads } from "@/context/DownloadContext";
import { modelService, notificationService, settingsService } from "@/services";
import type { ModelInfo } from "@/services/types";
import { alpha } from "@/theme/alpha";
import { tokens } from "@/theme/tokens";
import { formatGB } from "@/utils/format";
import { requiredMemoryBytes, vibrate } from "@/utils/platform";
import { useCatalogModel } from "@/utils/useCatalogModel";
import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import styled, { keyframes } from "styled-components";

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
`;

const Page = styled.div`
  padding: 1.25rem;
  animation: ${fadeIn} 0.3s ease-out both;
`;

const Header = styled.div`
  margin-bottom: 1.5rem;
`;

const CompanyTag = styled.span`
  font-size: ${tokens.typography.fontSize.sm};
  color: ${tokens.colors.primary};
  font-weight: ${tokens.typography.fontWeight.semibold};
  text-transform: uppercase;
  letter-spacing: ${tokens.typography.letterSpacing.wider};
`;

const ModelName = styled.h1`
  font-family: ${tokens.typography.fontFamily.headline};
  font-size: clamp(1.75rem, 6vw, 2.25rem);
  font-weight: ${tokens.typography.fontWeight.bold};
  color: ${tokens.colors.onSurface};
  margin-top: 0.25rem;
`;

const TagBadge = styled.span`
  display: inline-block;
  font-size: 10px;
  font-weight: ${tokens.typography.fontWeight.bold};
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.2rem 0.5rem;
  border-radius: ${tokens.borderRadius.sm};
  background: ${alpha(tokens.colors.primary, "18")};
  color: ${tokens.colors.primary};
  margin-top: 0.5rem;
`;

const Description = styled.p`
  font-size: ${tokens.typography.fontSize.base};
  color: ${tokens.colors.onSurfaceVariant};
  line-height: ${tokens.typography.lineHeight.relaxed};
  margin-top: 1rem;
`;

const Section = styled.div`
  background: ${tokens.colors.surfaceContainerLow};
  border-radius: ${tokens.borderRadius.lg};
  margin-bottom: 1rem;
  overflow: hidden;
  animation: ${fadeIn} 0.3s ease-out both;
  animation-delay: 0.1s;
`;

const InfoRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
`;

const InfoLabel = styled.span`
  font-size: ${tokens.typography.fontSize.sm};
  color: ${tokens.colors.onSurfaceVariant};
`;

const InfoValue = styled.span`
  font-size: ${tokens.typography.fontSize.base};
  font-weight: ${tokens.typography.fontWeight.medium};
  color: ${tokens.colors.onSurface};
`;

const SectionLabel = styled.h2`
  font-size: ${tokens.typography.fontSize.sm};
  text-transform: uppercase;
  letter-spacing: ${tokens.typography.letterSpacing.widest};
  color: ${tokens.colors.onSurfaceVariant};
  margin-bottom: 0.5rem;
  padding-left: 0.25rem;
`;

const BestForList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin-bottom: 1.25rem;
`;

const BestForTag = styled.span`
  font-size: ${tokens.typography.fontSize.sm};
  padding: 0.3rem 0.625rem;
  border-radius: ${tokens.borderRadius.md};
  background: ${tokens.colors.surfaceContainerHigh};
  color: ${tokens.colors.onSurfaceVariant};
`;

const DownloadBtn = styled.button`
  width: 100%;
  padding: 0.875rem;
  border-radius: ${tokens.borderRadius.xl};
  background: linear-gradient(135deg, ${tokens.colors.primary}, ${tokens.colors.primaryContainer});
  color: ${tokens.colors.onPrimaryFixed};
  font-family: ${tokens.typography.fontFamily.label};
  font-size: ${tokens.typography.fontSize.md};
  font-weight: ${tokens.typography.fontWeight.bold};
  border: none;
  cursor: pointer;
  transition: transform ${tokens.transitions.normal};

  &:hover { transform: scale(0.98); }
  &:active { transform: scale(0.95); }
`;

const DownloadedBtn = styled(DownloadBtn)`
  background: ${tokens.colors.surfaceContainerHigh};
  color: ${tokens.colors.secondary};
`;

const SizeNote = styled.p`
  font-size: ${tokens.typography.fontSize.sm};
  color: ${tokens.colors.onSurfaceVariant};
  text-align: center;
  margin-top: 0.5rem;
`;

const Notice = styled.div<{ $tone: "warn" | "info" }>`
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  margin-top: 1rem;
  padding: 0.75rem 0.875rem;
  border-radius: ${tokens.borderRadius.xl};
  font-size: ${tokens.typography.fontSize.sm};
  line-height: ${tokens.typography.lineHeight.relaxed};
  color: ${tokens.colors.onSurface};
  background: ${({ $tone }) =>
		alpha($tone === "warn" ? tokens.colors.error : tokens.colors.tertiary, "14")};
  border: 1px solid ${({ $tone }) =>
		alpha($tone === "warn" ? tokens.colors.error : tokens.colors.tertiary, "40")};

  svg { margin-top: 2px; }
`;

export function ModelDetailPage() {
	const navigate = useNavigate();
	const location = useLocation();
	const stateModel = (location.state as { model?: ModelInfo } | null)?.model;
	// Allow deep-linking via ?id=... so reload doesn't kick back to /store.
	const idFromQuery = new URLSearchParams(location.search).get("id");
	const { model, lookupFailed } = useCatalogModel(stateModel, idFromQuery);
	const { downloads, installedVersion, startDownload } = useDownloads();
	const { showConfirm } = useConfirm();
	const [isDownloaded, setIsDownloaded] = useState(false);
	const [deviceMemory, setDeviceMemory] = useState<number | null>(null);
	const [freeBytes, setFreeBytes] = useState<number | null>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: installedVersion is the refresh trigger
	useEffect(() => {
		if (!model) return;
		modelService.getDownloadedModels()
			.then((models) => setIsDownloaded(models.some((m) => m.id === model.id)))
			.catch(() => {});
	}, [model, installedVersion]);

	useEffect(() => {
		settingsService.getDeviceInfo()
			.then((info) => setDeviceMemory(info.total_memory_bytes))
			.catch(() => {});
		settingsService.getAvailableSpace().then(setFreeBytes).catch(() => {});
	}, []);

	if (!model) {
		// Nothing to look up, or the id is unknown: back to the store.
		if (!idFromQuery || lookupFailed) return <Navigate to="/store" replace />;
		return (
			<AppLayout title="Model" back="/store">
				<Page aria-busy="true">
					<div style={{ padding: "2rem", textAlign: "center", color: tokens.colors.onSurfaceVariant }}>
						Loading model details…
					</div>
				</Page>
			</AppLayout>
		);
	}

	const dl = downloads[model.id];
	const inProgress = !!dl && dl.status !== "finished";
	const tooLarge = deviceMemory !== null && requiredMemoryBytes(model.size_bytes) > deviceMemory;
	const noSpace = freeBytes !== null && freeBytes < model.size_bytes;

	const handleDownload = async () => {
		const ok = await showConfirm({
			title: tooLarge ? "This model may not run here" : "Download model",
			message: tooLarge
				? `${model.name} needs about ${formatGB(requiredMemoryBytes(model.size_bytes))} GB of memory and this device has ${formatGB(deviceMemory ?? 0)} GB. It may fail to load or be very slow. Download ${model.size_label} anyway?`
				: `Download ${model.name}? It will use ${model.size_label} of storage.`,
			confirmLabel: tooLarge ? "Download anyway" : "Download",
			cancelLabel: "Cancel",
		});
		if (!ok) return;
		vibrate(10);
		// Ask for notifications here, where the reason is obvious: to be told
		// when a long download finishes.
		await notificationService.requestNotificationPermission();
		startDownload(model);
		navigate(`/downloading?id=${encodeURIComponent(model.id)}`, { state: { model } });
	};

	return (
		<AppLayout title={model.name} back="/store">
			<OfflineBanner />
			<Page>
				<Header>
					<CompanyTag>{model.company}</CompanyTag>
					<ModelName>{model.name}</ModelName>
					<TagBadge>{model.tag}</TagBadge>
				</Header>

				<Description>{model.description}</Description>

				{tooLarge && !isDownloaded && (
					<Notice $tone="warn" role="note">
						<Icon name="warning" size={16} color={tokens.colors.error} />
						<span>
							This model needs about {formatGB(requiredMemoryBytes(model.size_bytes))} GB of memory;
							this device has {formatGB(deviceMemory ?? 0)} GB. A smaller model will work better.
						</span>
					</Notice>
				)}
				{noSpace && !isDownloaded && !inProgress && (
					<Notice $tone="warn" role="note">
						<Icon name="storage" size={16} color={tokens.colors.error} />
						<span>
							Not enough free storage: {formatGB(freeBytes ?? 0)} GB free, {model.size_label} needed.
						</span>
					</Notice>
				)}

				<SectionLabel style={{ marginTop: "1.25rem" }}>Best for</SectionLabel>
				<BestForList>
					{model.best_for.map((item) => (
						<BestForTag key={item}>{item}</BestForTag>
					))}
				</BestForList>

				<SectionLabel>Specifications</SectionLabel>
				<Section>
					<InfoRow>
						<InfoLabel>Company</InfoLabel>
						<InfoValue>{model.company}</InfoValue>
					</InfoRow>
					<InfoRow>
						<InfoLabel>Parameters</InfoLabel>
						<InfoValue>{model.parameters}</InfoValue>
					</InfoRow>
					<InfoRow>
						<InfoLabel>Quantization</InfoLabel>
						<InfoValue>{model.quantization}</InfoValue>
					</InfoRow>
					<InfoRow>
						<InfoLabel>Context window</InfoLabel>
						<InfoValue>{model.context_length.toLocaleString()} tokens</InfoValue>
					</InfoRow>
					<InfoRow>
						<InfoLabel>Download size</InfoLabel>
						<InfoValue>{model.size_label}</InfoValue>
					</InfoRow>
				</Section>

				{isDownloaded ? (
					<DownloadedBtn type="button" onClick={() => navigate("/models")}>
						Installed — open My Models
					</DownloadedBtn>
				) : inProgress ? (
					<DownloadBtn
						type="button"
						onClick={() =>
							navigate(`/downloading?id=${encodeURIComponent(model.id)}`, { state: { model } })
						}
					>
						{dl.status === "paused"
							? "Download paused — view"
							: dl.status === "failed"
								? "Download failed — view"
								: "Downloading — view progress"}
					</DownloadBtn>
				) : (
					<>
						<DownloadBtn type="button" onClick={handleDownload} disabled={noSpace}>
							Download {model.name}
						</DownloadBtn>
						<SizeNote>
							{model.size_label} · downloaded once, then works offline
						</SizeNote>
					</>
				)}
			</Page>
		</AppLayout>
	);
}
