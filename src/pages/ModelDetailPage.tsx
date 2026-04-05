import { AppLayout } from "@/components/layout/AppLayout";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Icon } from "@/components/ui/Icon";
import { OfflineBanner } from "@/components/ui/OfflineBanner";
import { useDownloads } from "@/context/DownloadContext";
import { modelService } from "@/services";
import type { ModelInfo } from "@/services/types";
import { tokens } from "@/theme/tokens";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import styled, { keyframes } from "styled-components";

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
`;

const Page = styled.div`
  padding: 1.25rem;
  animation: ${fadeIn} 0.3s ease-out both;
`;

const BackBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  background: none;
  border: none;
  color: ${tokens.colors.onSurfaceVariant};
  font-size: ${tokens.typography.fontSize.sm};
  cursor: pointer;
  padding: 0;
  margin-bottom: 1rem;

  &:active { opacity: 0.7; }
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
  background: ${tokens.colors.primary}18;
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

export function ModelDetailPage() {
	const navigate = useNavigate();
	const location = useLocation();
	const model = (location.state as { model?: ModelInfo })?.model;
	const { downloads, startDownload } = useDownloads();
	const { showConfirm } = useConfirm();
	const [isDownloaded, setIsDownloaded] = useState(false);

	useEffect(() => {
		if (!model) return;
		modelService.getDownloadedModels().then((models) => {
			setIsDownloaded(models.some((m) => m.id === model.id));
		});
	}, [model]);

	if (!model) {
		navigate("/store");
		return null;
	}

	const dl = downloads[model.id];
	const isDownloading = dl?.status === "downloading" || dl?.status === "paused";

	const handleDownload = async () => {
		const ok = await showConfirm({
			title: "Download Model",
			message: `Download ${model.name}? This will use ${model.size_label} of storage.`,
			confirmLabel: "Download",
			cancelLabel: "Cancel",
		});
		if (!ok) return;
		if (navigator.vibrate) navigator.vibrate(10);
		startDownload(model);
		navigate("/downloading", { state: { model } });
	};

	return (
		<AppLayout title={model?.name || "Model"}>
			<OfflineBanner />
			<Page>
				<BackBtn onClick={() => navigate("/store")}>
					<Icon name="arrow_back" size={18} />
					Back to Store
				</BackBtn>

				<Header>
					<CompanyTag>{model.company}</CompanyTag>
					<ModelName>{model.name}</ModelName>
					<TagBadge>{model.tag}</TagBadge>
				</Header>

				<Description>{model.description}</Description>

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
						<InfoLabel>Download Size</InfoLabel>
						<InfoValue>{model.size_label}</InfoValue>
					</InfoRow>
				</Section>

				{isDownloaded ? (
					<DownloadedBtn onClick={() => navigate("/models")}>
						Already Downloaded — Go to Models
					</DownloadedBtn>
				) : isDownloading ? (
					<DownloadBtn onClick={() => navigate("/downloading", { state: { model } })}>
						Downloading... Tap to View
					</DownloadBtn>
				) : (
					<>
						<DownloadBtn onClick={handleDownload}>
							Download {model.name}
						</DownloadBtn>
						<SizeNote>
							This will download {model.size_label} to your device
						</SizeNote>
					</>
				)}
			</Page>
		</AppLayout>
	);
}
