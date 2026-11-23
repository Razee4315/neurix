import { AppLayout } from "@/components/layout/AppLayout";
import { Icon } from "@/components/ui/Icon";
import { ModelMeters } from "@/components/ui/Meter";
import { OfflineBanner } from "@/components/ui/OfflineBanner";
import { useAppContext } from "@/context/AppContext";
import { useDownloads } from "@/context/DownloadContext";
import { modelService, settingsService } from "@/services";
import type { ModelInfo, Reasoning } from "@/services/types";
import { alpha } from "@/theme/alpha";
import { tokens } from "@/theme/tokens";
import { formatGB } from "@/utils/format";
import { fitSummary, modelFit, nominalRamGb } from "@/utils/modelFit";
import { useCatalogModel } from "@/utils/useCatalogModel";
import { useModelDownload } from "@/utils/useModelDownload";
import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import styled, { keyframes } from "styled-components";

const fadeIn = keyframes`
	from { opacity: 0; transform: translateY(8px); }
	to { opacity: 1; transform: translateY(0); }
`;

const Page = styled.div`
	max-width: 44rem;
	margin: 0 auto;
	padding: 1.25rem;
	display: flex;
	flex-direction: column;
	gap: 1.25rem;
	animation: ${fadeIn} 0.24s cubic-bezier(0.16, 1, 0.3, 1) both;
`;

/* ── Top Hero Action Card (Guarantees Above-the-Fold Primary CTA on 800px Desktop) ── */

const HeroActionCard = styled.section`
	display: flex;
	flex-direction: column;
	gap: 0.875rem;
	padding: 1.25rem;
	border-radius: ${tokens.borderRadius.xl};
	background: ${tokens.colors.surfaceContainerLow};
	border: 1px solid ${tokens.colors.outlineVariant};
`;

const HeroTopRow = styled.div`
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	flex-wrap: wrap;
	gap: 0.75rem;
`;

const HeroTitleGroup = styled.div`
	display: flex;
	flex-direction: column;
	gap: 0.2rem;
	min-width: 0;
	flex: 1;
`;

const CompanyTag = styled.span`
	font-size: ${tokens.typography.fontSize.xs};
	color: ${tokens.colors.primary};
	font-weight: ${tokens.typography.fontWeight.bold};
	text-transform: uppercase;
	letter-spacing: ${tokens.typography.letterSpacing.wider};
`;

const ModelName = styled.h1`
	font-family: ${tokens.typography.fontFamily.headline};
	font-size: clamp(1.5rem, 5vw, 2rem);
	font-weight: ${tokens.typography.fontWeight.bold};
	color: ${tokens.colors.onSurface};
	line-height: 1.15;
`;

const MetaBadges = styled.div`
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 0.375rem;
`;

const TagBadge = styled.span`
	display: inline-flex;
	align-items: center;
	font-size: 10px;
	font-weight: ${tokens.typography.fontWeight.bold};
	text-transform: uppercase;
	letter-spacing: 0.05em;
	padding: 0.2rem 0.5rem;
	border-radius: ${tokens.borderRadius.sm};
	background: ${alpha(tokens.colors.primary, "18")};
	color: ${tokens.colors.primary};
`;

const MonoPill = styled.span`
	display: inline-flex;
	align-items: center;
	font-family: ${tokens.typography.fontFamily.mono};
	font-variant-numeric: tabular-nums;
	font-size: 11px;
	font-weight: ${tokens.typography.fontWeight.semibold};
	padding: 0.2rem 0.5rem;
	border-radius: ${tokens.borderRadius.sm};
	background: ${tokens.colors.surfaceContainerHigh};
	color: ${tokens.colors.onSurfaceVariant};
`;

const Description = styled.p`
	font-size: ${tokens.typography.fontSize.base};
	color: ${tokens.colors.onSurfaceVariant};
	line-height: ${tokens.typography.lineHeight.relaxed};
	margin: 0;
`;

const MetersAndTagsRow = styled.div`
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	justify-content: space-between;
	gap: 0.5rem 1rem;
`;

const Meters = styled.div`
	display: flex;
	flex-wrap: wrap;
	gap: 0.375rem 1rem;
`;

const BestForList = styled.div`
	display: flex;
	flex-wrap: wrap;
	gap: 0.375rem;
`;

const BestForTag = styled.span`
	font-size: ${tokens.typography.fontSize.xs};
	padding: 0.225rem 0.55rem;
	border-radius: ${tokens.borderRadius.md};
	background: ${tokens.colors.surfaceContainerHigh};
	color: ${tokens.colors.onSurfaceVariant};
`;

const FitCallout = styled.div<{ $tone: "good" | "warn" }>`
	display: flex;
	gap: 0.5rem;
	align-items: center;
	justify-content: space-between;
	flex-wrap: wrap;
	padding: 0.65rem 0.875rem;
	border-radius: ${tokens.borderRadius.lg};
	font-size: ${tokens.typography.fontSize.sm};
	line-height: 1.45;
	color: ${tokens.colors.onSurface};
	background: ${({ $tone }) =>
		alpha(
			$tone === "warn" ? tokens.colors.error : tokens.colors.primary,
			"12",
		)};
	border: 1px solid
		${({ $tone }) =>
			alpha(
				$tone === "warn" ? tokens.colors.error : tokens.colors.primary,
				"40",
			)};
`;

const FitCalloutLeft = styled.div`
	display: flex;
	align-items: center;
	gap: 0.5rem;
	flex: 1;
	min-width: 12rem;
`;

const FitStatusBadge = styled.span<{ $tone: "good" | "warn" }>`
	font-family: ${tokens.typography.fontFamily.mono};
	font-size: 11px;
	font-weight: ${tokens.typography.fontWeight.bold};
	text-transform: uppercase;
	letter-spacing: 0.04em;
	padding: 0.175rem 0.5rem;
	border-radius: ${tokens.borderRadius.sm};
	color: ${({ $tone }) =>
		$tone === "warn" ? tokens.colors.error : tokens.colors.primary};
	background: ${({ $tone }) =>
		alpha(
			$tone === "warn" ? tokens.colors.error : tokens.colors.primary,
			"1e",
		)};
`;

const CtaRow = styled.div`
	display: flex;
	flex-direction: column;
	gap: 0.375rem;
	padding-top: 0.25rem;
`;

const DownloadBtn = styled.button`
	width: 100%;
	min-height: 48px;
	padding: 0.8rem 1rem;
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

	&:hover:not(:disabled) {
		filter: brightness(1.06);
	}
	&:active:not(:disabled) {
		transform: scale(0.98);
	}
	&:disabled {
		opacity: 0.5;
		cursor: default;
	}
`;

const DownloadedBtn = styled(DownloadBtn)`
	background: ${tokens.colors.surfaceContainerHigh};
	color: ${tokens.colors.secondary};
	border: 1px solid ${alpha(tokens.colors.secondary, "45")};
`;

const SizeNote = styled.p`
	font-size: ${tokens.typography.fontSize.xs};
	color: ${tokens.colors.onSurfaceVariant};
	text-align: center;
	margin: 0;
`;

/* ── 2-Column Specifications Bento Grid ── */

const SectionBlock = styled.section`
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
`;

const SectionLabel = styled.h2`
	font-size: 11px;
	font-weight: ${tokens.typography.fontWeight.bold};
	text-transform: uppercase;
	letter-spacing: 0.12em;
	color: ${tokens.colors.onSurfaceVariant};
	padding-left: 0.125rem;
`;

const SpecsBentoGrid = styled.div`
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 0.5rem;

	@media (max-width: 460px) {
		grid-template-columns: 1fr;
	}
`;

const SpecCell = styled.div`
	display: flex;
	flex-direction: column;
	justify-content: space-between;
	gap: 0.25rem;
	padding: 0.75rem 0.875rem;
	border-radius: ${tokens.borderRadius.lg};
	background: ${tokens.colors.surfaceContainerLow};
	border: 1px solid ${tokens.colors.outlineVariant};
`;

const InfoLabel = styled.span`
	font-size: ${tokens.typography.fontSize.xs};
	color: ${tokens.colors.onSurfaceVariant};
`;

const InfoValue = styled.span<{ $mono?: boolean }>`
	font-family: ${({ $mono }) =>
		$mono
			? tokens.typography.fontFamily.mono
			: tokens.typography.fontFamily.body};
	font-variant-numeric: tabular-nums;
	font-size: ${tokens.typography.fontSize.sm};
	font-weight: ${tokens.typography.fontWeight.semibold};
	color: ${tokens.colors.onSurface};
	overflow-wrap: anywhere;
`;

const REASONING_LABEL: Record<Reasoning, string> = {
	none: "Answers directly",
	optional: "Can think first (you choose)",
	always: "Always thinks first",
};

/** "2026-02" -> "February 2026". */
function releaseLabel(released: string): string {
	const [year, month] = released.split("-").map(Number);
	if (!year || !month) return released;
	return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
		month: "long",
		year: "numeric",
	});
}

export function ModelDetailPage() {
	const navigate = useNavigate();
	const location = useLocation();
	const { settings } = useAppContext();
	const stateModel = (location.state as { model?: ModelInfo } | null)?.model;
	// Allow deep-linking via ?id=... so reload doesn't kick back to /store.
	const idFromQuery = new URLSearchParams(location.search).get("id");
	const { model, lookupFailed } = useCatalogModel(stateModel, idFromQuery);
	const { downloads, installedVersion } = useDownloads();
	const download = useModelDownload();
	const [isDownloaded, setIsDownloaded] = useState(false);
	const [deviceMemory, setDeviceMemory] = useState<number | null>(null);
	const [freeBytes, setFreeBytes] = useState<number | null>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: installedVersion is the refresh trigger
	useEffect(() => {
		if (!model) return;
		modelService
			.getDownloadedModels()
			.then((models) =>
				setIsDownloaded(models.some((m) => m.id === model.id)),
			)
			.catch(() => {});
	}, [model, installedVersion]);

	useEffect(() => {
		settingsService
			.getDeviceInfo()
			.then((info) => setDeviceMemory(info.total_memory_bytes))
			.catch(() => {});
		settingsService
			.getAvailableSpace()
			.then(setFreeBytes)
			.catch(() => {});
	}, []);

	if (!model) {
		// Nothing to look up, or the id is unknown: back to the store.
		if (!idFromQuery || lookupFailed) return <Navigate to="/store" replace />;
		return (
			<AppLayout title="Model" back="/store">
				<Page aria-busy="true">
					<div
						style={{
							padding: "2rem",
							textAlign: "center",
							color: tokens.colors.onSurfaceVariant,
						}}
					>
						Loading model details…
					</div>
				</Page>
			</AppLayout>
		);
	}

	const dl = downloads[model.id];
	const inProgress = !!dl && dl.status !== "finished";
	const fit = modelFit(model, deviceMemory);
	const noSpace = freeBytes !== null && freeBytes < model.size_bytes;
	const added = model.tag === "Added";
	const ramGb = nominalRamGb(deviceMemory);
	const warnFit = fit === "tight" || fit === "too_big";
	const fitLabel =
		fit === "too_big"
			? "May be slow"
			: fit === "tight"
				? "Tight fit"
				: "Fits comfortably";

	return (
		<AppLayout title={model.name} back="/store">
			<OfflineBanner />
			<Page>
				<HeroActionCard>
					<HeroTopRow>
						<HeroTitleGroup>
							<CompanyTag>{model.company}</CompanyTag>
							<ModelName>{model.name}</ModelName>
						</HeroTitleGroup>
						<MetaBadges>
							<TagBadge>{model.tag}</TagBadge>
							<MonoPill>{model.quantization.split(" ")[0]}</MonoPill>
							<MonoPill>{model.size_label}</MonoPill>
						</MetaBadges>
					</HeroTopRow>

					<Description>{model.description}</Description>

					<MetersAndTagsRow>
						{!added && (
							<Meters>
								<ModelMeters quality={model.quality} speed={model.speed} />
							</Meters>
						)}
						{model.best_for.length > 0 && (
							<BestForList>
								{model.best_for.map((item) => (
									<BestForTag key={item}>{item}</BestForTag>
								))}
							</BestForList>
						)}
					</MetersAndTagsRow>

					{!isDownloaded && (
						<FitCallout $tone={warnFit || noSpace ? "warn" : "good"} role="note">
							<FitCalloutLeft>
								<Icon
									name={warnFit || noSpace ? "warning" : "check_circle"}
									size={16}
									color={
										warnFit || noSpace
											? tokens.colors.error
											: tokens.colors.primary
									}
								/>
								<span>
									{noSpace
										? `Not enough free storage: ${formatGB(freeBytes ?? 0)} GB free, ${model.size_label} needed.`
										: `${fitSummary(model, deviceMemory)}.${
												fit === "too_big"
													? " A smaller model will run more reliably."
													: fit === "tight"
														? " Expect slower generation under memory load."
														: ""
											}`}
								</span>
							</FitCalloutLeft>
							<FitStatusBadge $tone={warnFit || noSpace ? "warn" : "good"}>
								{noSpace ? "Low disk" : fitLabel}
							</FitStatusBadge>
						</FitCallout>
					)}

					<CtaRow>
						{isDownloaded ? (
							<DownloadedBtn type="button" onClick={() => navigate("/models")}>
								<Icon name="check_circle" size={18} />
								Installed. Open My Models
							</DownloadedBtn>
						) : inProgress ? (
							<DownloadBtn
								type="button"
								onClick={() =>
									navigate(
										`/downloading?id=${encodeURIComponent(model.id)}`,
										{ state: { model } },
									)
								}
							>
								<Icon name="downloading" size={18} />
								{dl.status === "paused"
									? "Download paused. View it"
									: dl.status === "failed"
										? "Download failed. View it"
										: "Downloading. View progress"}
							</DownloadBtn>
						) : (
							<>
								<DownloadBtn
									type="button"
									onClick={() => download(model, deviceMemory)}
									disabled={noSpace || Boolean(settings?.air_gap)}
								>
									<Icon name="download" size={18} />
									Download · {model.size_label}
								</DownloadBtn>
								<SizeNote>
									{settings?.air_gap
										? "Air-Gap Mode is active — disable Air-Gap in Settings to download new weights"
										: `Downloaded once (${model.size_label}), verified with SHA-256, then runs 100% offline`}
								</SizeNote>
							</>
						)}
					</CtaRow>
				</HeroActionCard>

				<SectionBlock>
					<SectionLabel>Specifications</SectionLabel>
					<SpecsBentoGrid>
						<SpecCell>
							<InfoLabel>{added ? "Uploaded by" : "Company"}</InfoLabel>
							<InfoValue>{model.company}</InfoValue>
						</SpecCell>
						<SpecCell>
							<InfoLabel>Parameters</InfoLabel>
							<InfoValue $mono>{model.parameters}</InfoValue>
						</SpecCell>
						<SpecCell>
							<InfoLabel>Quantization</InfoLabel>
							<InfoValue $mono>{model.quantization}</InfoValue>
						</SpecCell>
						<SpecCell>
							<InfoLabel>Memory needed</InfoLabel>
							<InfoValue $mono>
								{model.min_ram_gb} GB
								{ramGb ? ` (device: ${ramGb} GB)` : ""}
							</InfoValue>
						</SpecCell>
						<SpecCell>
							<InfoLabel>Context window</InfoLabel>
							<InfoValue $mono>
								up to {model.context_length.toLocaleString()} tokens
							</InfoValue>
						</SpecCell>
						<SpecCell>
							<InfoLabel>Reasoning</InfoLabel>
							<InfoValue>{REASONING_LABEL[model.reasoning]}</InfoValue>
						</SpecCell>
						<SpecCell>
							<InfoLabel>Download size</InfoLabel>
							<InfoValue $mono>{model.size_label}</InfoValue>
						</SpecCell>
						{model.released && (
							<SpecCell>
								<InfoLabel>Released</InfoLabel>
								<InfoValue>{releaseLabel(model.released)}</InfoValue>
							</SpecCell>
						)}
					</SpecsBentoGrid>
				</SectionBlock>
			</Page>
		</AppLayout>
	);
}
