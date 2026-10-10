import { AppLayout } from "@/components/layout/AppLayout";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { ModelMeters } from "@/components/ui/Meter";
import { OfflineBanner } from "@/components/ui/OfflineBanner";
import { useDownloads } from "@/context/DownloadContext";
import { modelService, settingsService } from "@/services";
import type { ModelInfo } from "@/services/types";
import { alpha } from "@/theme/alpha";
import { tokens } from "@/theme/tokens";
import { formatGB } from "@/utils/format";
import { fitSummary, modelFit, nominalRamGb, recommendModel } from "@/utils/modelFit";
import { useModelDownload } from "@/utils/useModelDownload";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled, { keyframes } from "styled-components";

const FILTERS = ["All", "Tiny", "Fast", "Balanced", "Smart"];

/* ── Styles ── */

const Page = styled.div`
  padding: 1.25rem;
  max-width: 44rem;
  margin: 0 auto;
`;

const SearchBox = styled.div`
  position: relative;
  margin-bottom: 1rem;
`;

const SearchInput = styled.input`
  width: 100%;
  height: 44px;
  padding: 0 1rem 0 2.5rem;
  background: ${tokens.colors.surfaceContainerHighest};
  border: none;
  border-radius: ${tokens.borderRadius.lg};
  font-size: ${tokens.typography.fontSize.base};
  color: ${tokens.colors.onSurface};
  outline: none;

  &::placeholder {
    color: ${tokens.colors.outline};
  }
  &:focus {
    box-shadow: inset 0 -2px 0 ${tokens.colors.primary};
  }
`;

const SearchIconWrap = styled.div`
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  color: ${tokens.colors.onSurfaceVariant};
  display: flex;
`;

const slideIn = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
`;

/* The pick for this device: the one decision most people need the store to
   make for them. It carries its own download button so a first-time user
   gets from here to a running model in a single tap. */
const Pick = styled.section`
  position: relative;
  margin-bottom: 1.25rem;
  padding: 1rem;
  border-radius: ${tokens.borderRadius.xl};
  background: linear-gradient(
    150deg,
    ${alpha(tokens.colors.primary, "1f")},
    ${alpha(tokens.colors.secondary, "0f")} 70%
  ), ${tokens.colors.surfaceContainerLow};
  border: 1px solid ${alpha(tokens.colors.primary, "40")};
  animation: ${slideIn} 0.3s ease-out both;
`;

const PickLabel = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 10px;
  font-weight: ${tokens.typography.fontWeight.bold};
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: ${tokens.colors.primary};
  margin-bottom: 0.5rem;
`;

const PickHead = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
`;

const PickName = styled.h2`
  font-family: ${tokens.typography.fontFamily.headline};
  font-size: ${tokens.typography.fontSize.xl};
  font-weight: ${tokens.typography.fontWeight.bold};
  color: ${tokens.colors.onSurface};
`;

const PickText = styled.p`
  margin-top: 0.375rem;
  font-size: ${tokens.typography.fontSize.base};
  line-height: ${tokens.typography.lineHeight.relaxed};
  color: ${tokens.colors.onSurfaceVariant};
`;

const MeterRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.375rem 0.875rem;
  margin-top: 0.5rem;
`;

const PickActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.75rem;
  margin-top: 0.875rem;
`;

const PickButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 44px;
  padding: 0 1.125rem;
  border: none;
  border-radius: ${tokens.borderRadius.lg};
  background: ${tokens.colors.primary};
  color: ${tokens.colors.onPrimaryFixed};
  font-size: ${tokens.typography.fontSize.base};
  font-weight: ${tokens.typography.fontWeight.bold};
  cursor: pointer;
  transition: transform 0.1s ease, filter ${tokens.transitions.fast};

  &:hover { filter: brightness(1.08); }
  &:active { transform: scale(0.97); }
  &:focus-visible { outline: 2px solid ${tokens.colors.onSurface}; outline-offset: 2px; }
`;

const PickDetails = styled.button`
  min-height: 44px;
  padding: 0 0.5rem;
  border: none;
  background: none;
  color: ${tokens.colors.onSurfaceVariant};
  font-size: ${tokens.typography.fontSize.sm};
  font-weight: ${tokens.typography.fontWeight.semibold};
  cursor: pointer;

  &:hover { color: ${tokens.colors.onSurface}; }
`;

const PickReason = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin-top: 0.625rem;
  font-size: ${tokens.typography.fontSize.xs};
  color: ${tokens.colors.secondary};
`;

const SectionRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.625rem;
`;

const SectionTitle = styled.h2`
  font-size: 11px;
  font-weight: ${tokens.typography.fontWeight.bold};
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: ${tokens.colors.onSurfaceVariant};
`;

const StorageHint = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: ${tokens.typography.fontSize.xs};
  color: ${tokens.colors.onSurfaceVariant};
`;

const Chips = styled.div`
  display: flex;
  gap: 0.375rem;
  overflow-x: auto;
  margin-bottom: 0.875rem;
  &::-webkit-scrollbar { display: none; }
  scrollbar-width: none;
`;

const Chip = styled.button<{ $active: boolean }>`
  flex-shrink: 0;
  min-height: 36px;
  padding: 0 0.875rem;
  border-radius: ${tokens.borderRadius.md};
  border: none;
  font-size: ${tokens.typography.fontSize.sm};
  font-weight: ${tokens.typography.fontWeight.semibold};
  cursor: pointer;
  transition: all ${tokens.transitions.fast};
  background: ${({ $active }) =>
		$active ? tokens.colors.primary : tokens.colors.surfaceContainerHigh};
  color: ${({ $active }) =>
		$active ? tokens.colors.onPrimaryFixed : tokens.colors.onSurfaceVariant};

  &:hover {
    background: ${({ $active }) =>
			$active ? tokens.colors.primary : tokens.colors.surfaceBright};
  }
  &:active { transform: scale(0.95); }
`;

const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

const SkeletonCard = styled.div`
  width: 100%;
  background: ${tokens.colors.surfaceContainerLow};
  border-radius: ${tokens.borderRadius.lg};
  padding: 1rem;
`;

const SkeletonLine = styled.div<{ $w?: string; $h?: string }>`
  width: ${({ $w }) => $w || "100%"};
  height: ${({ $h }) => $h || "14px"};
  border-radius: ${tokens.borderRadius.md};
  background: linear-gradient(
    90deg,
    ${tokens.colors.surfaceContainerHighest} 25%,
    ${tokens.colors.surfaceBright} 50%,
    ${tokens.colors.surfaceContainerHighest} 75%
  );
  background-size: 200% 100%;
  animation: ${shimmer} 1.5s ease-in-out infinite;
`;

const CatalogError = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 2rem 1rem;
  text-align: center;
`;

const CatalogErrorTitle = styled.div`
  font-family: ${tokens.typography.fontFamily.headline};
  font-size: ${tokens.typography.fontSize.md};
  font-weight: ${tokens.typography.fontWeight.bold};
  color: ${tokens.colors.onSurface};
`;

const CatalogErrorMessage = styled.div`
  font-size: ${tokens.typography.fontSize.sm};
  color: ${tokens.colors.onSurfaceVariant};
  max-width: 280px;
  line-height: ${tokens.typography.lineHeight.relaxed};
`;

const RetryButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
  padding: 0.625rem 1.25rem;
  border-radius: ${tokens.borderRadius.lg};
  background: ${tokens.colors.primary};
  color: ${tokens.colors.onPrimary};
  font-size: ${tokens.typography.fontSize.sm};
  font-weight: ${tokens.typography.fontWeight.bold};
  border: none;
  cursor: pointer;

  &:active { transform: scale(0.96); }
`;

const Cards = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const Card = styled.button`
  width: 100%;
  text-align: left;
  background: ${tokens.colors.surfaceContainerLow};
  border: none;
  border-radius: ${tokens.borderRadius.lg};
  padding: 0.875rem 1rem;
  cursor: pointer;
  transition: background ${tokens.transitions.fast}, transform 0.1s ease;
  animation: ${slideIn} 0.3s ease-out both;

  &:hover { background: ${tokens.colors.surfaceContainerHigh}; }
  &:active { transform: scale(0.99); }
  &:focus-visible { outline: 2px solid ${tokens.colors.primary}; outline-offset: 2px; }
`;

const CardTop = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
`;

const CardName = styled.h3`
  font-family: ${tokens.typography.fontFamily.headline};
  font-size: ${tokens.typography.fontSize.md};
  font-weight: ${tokens.typography.fontWeight.bold};
  color: ${tokens.colors.onSurface};
`;

const CardMaker = styled.span`
  margin-left: 0.5rem;
  font-family: ${tokens.typography.fontFamily.body};
  font-size: ${tokens.typography.fontSize.xs};
  font-weight: ${tokens.typography.fontWeight.medium};
  color: ${tokens.colors.onSurfaceVariant};
`;

const CardSize = styled.span`
  flex-shrink: 0;
  font-size: ${tokens.typography.fontSize.sm};
  font-family: ${tokens.typography.fontFamily.mono};
  color: ${tokens.colors.onSurfaceVariant};
`;

const CardDesc = styled.p`
  margin-top: 0.25rem;
  font-size: ${tokens.typography.fontSize.sm};
  line-height: 1.45;
  color: ${tokens.colors.onSurfaceVariant};
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const CardBottom = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 0.5rem;
`;

const Badge = styled.span<{ $tone: "ok" | "busy" | "muted" }>`
  flex-shrink: 0;
  font-size: 10px;
  font-weight: ${tokens.typography.fontWeight.bold};
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.2rem 0.5rem;
  border-radius: ${tokens.borderRadius.sm};
  color: ${({ $tone }) =>
		$tone === "ok"
			? tokens.colors.secondary
			: $tone === "busy"
				? tokens.colors.tertiary
				: tokens.colors.onSurfaceVariant};
  background: ${({ $tone }) =>
		$tone === "ok"
			? alpha(tokens.colors.secondary, "18")
			: $tone === "busy"
				? alpha(tokens.colors.tertiary, "22")
				: tokens.colors.surfaceContainerHighest};
`;

const Tag = styled.span`
  font-size: 10px;
  font-weight: ${tokens.typography.fontWeight.semibold};
  padding: 0.125rem 0.375rem;
  border-radius: ${tokens.borderRadius.sm};
  color: ${tokens.colors.onSurfaceVariant};
  border: 1px solid ${alpha(tokens.colors.outlineVariant, "80")};
  white-space: nowrap;
`;

const FitNote = styled.div<{ $severe: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin-top: 0.5rem;
  font-size: ${tokens.typography.fontSize.xs};
  color: ${({ $severe }) => ($severe ? tokens.colors.error : tokens.colors.tertiary)};
`;

const Footnote = styled.p`
  margin-top: 1rem;
  font-size: ${tokens.typography.fontSize.xs};
  line-height: ${tokens.typography.lineHeight.relaxed};
  color: ${tokens.colors.outline};
  text-align: center;
`;

/* ── Component ── */

export function ModelStorePage() {
	const navigate = useNavigate();
	const { downloads, installedVersion } = useDownloads();
	const download = useModelDownload();
	const [filter, setFilter] = useState(0);
	const [search, setSearch] = useState("");
	const [catalog, setCatalog] = useState<ModelInfo[]>([]);
	const [catalogStatus, setCatalogStatus] = useState<"loading" | "ready" | "error">("loading");
	const [catalogError, setCatalogError] = useState<string>("");
	const [downloadedIds, setDownloadedIds] = useState<Set<string> | null>(null);
	const [freeSpace, setFreeSpace] = useState<string | null>(null);
	const [deviceMemory, setDeviceMemory] = useState<number | null>(null);

	const loadCatalog = useCallback(() => {
		setCatalogStatus("loading");
		setCatalogError("");
		modelService.getCatalog()
			.then((c) => {
				setCatalog(c);
				setCatalogStatus("ready");
			})
			.catch((e) => {
				setCatalogError(typeof e === "string" ? e : (e?.message ?? "Could not load model catalog"));
				setCatalogStatus("error");
			});
	}, []);

	useEffect(() => {
		loadCatalog();
		settingsService.getDeviceInfo()
			.then((info) => setDeviceMemory(info.total_memory_bytes))
			.catch(() => {});
	}, [loadCatalog]);

	// Installed models and free space change only when a download finishes
	// or is discarded — not on every progress tick.
	// biome-ignore lint/correctness/useExhaustiveDependencies: installedVersion is the refresh trigger
	useEffect(() => {
		modelService.getDownloadedModels()
			.then((models) => setDownloadedIds(new Set(models.map((m) => m.id))))
			.catch(() => setDownloadedIds(new Set()));
		settingsService.getAvailableSpace()
			.then((bytes) => setFreeSpace(formatGB(bytes)))
			.catch(() => {});
	}, [installedVersion]);

	const installed = downloadedIds ?? new Set<string>();

	// Superseded models stay out of the store unless the user already has
	// one, in which case its page should still be reachable.
	const offered = useMemo(
		() => catalog.filter((m) => !m.legacy || downloadedIds?.has(m.id)),
		[catalog, downloadedIds],
	);

	const pick = useMemo(() => recommendModel(catalog, deviceMemory), [catalog, deviceMemory]);

	const query = search.trim().toLowerCase();
	const filtered = offered.filter((m) => {
		const matchesSearch =
			!query ||
			m.name.toLowerCase().includes(query) ||
			m.description.toLowerCase().includes(query) ||
			m.company.toLowerCase().includes(query) ||
			m.best_for.some((b) => b.toLowerCase().includes(query));
		const matchesFilter = filter === 0 || m.tag === FILTERS[filter];
		return matchesSearch && matchesFilter;
	});

	const openModel = (model: ModelInfo) => {
		const inProgress = downloads[model.id] && downloads[model.id].status !== "finished";
		// The ?id query lets either page recover after a reload.
		navigate(`${inProgress ? "/downloading" : "/store/model"}?id=${encodeURIComponent(model.id)}`, {
			state: { model },
		});
	};

	const statusBadge = (m: ModelInfo) => {
		const dl = downloads[m.id];
		if (installed.has(m.id)) return <Badge $tone="ok">Installed</Badge>;
		if (dl?.status === "downloading") {
			const pct = Math.round((dl.downloadedBytes / Math.max(dl.totalBytes, 1)) * 100);
			return <Badge $tone="busy">{pct}%</Badge>;
		}
		if (dl?.status === "verifying") return <Badge $tone="busy">Checking…</Badge>;
		if (dl?.status === "paused") return <Badge $tone="busy">Paused</Badge>;
		if (dl?.status === "failed") return <Badge $tone="busy">Failed</Badge>;
		if (m.legacy) return <Badge $tone="muted">Legacy</Badge>;
		return <Icon name="chevron_right" size={18} color={tokens.colors.outline} />;
	};

	// The pick is for someone deciding what to get. Once they are searching
	// or filtering, or already have it, it is in the way.
	const pickBusy = pick ? downloads[pick.id] && downloads[pick.id].status !== "finished" : false;
	const showPick =
		catalogStatus === "ready" &&
		downloadedIds !== null &&
		pick !== null &&
		!installed.has(pick.id) &&
		!pickBusy &&
		!query &&
		filter === 0;
	const ramGb = nominalRamGb(deviceMemory);

	return (
		<AppLayout title="Model Store">
			<OfflineBanner />
			<Page>
				<SearchBox>
					<SearchIconWrap>
						<Icon name="search" size={18} />
					</SearchIconWrap>
					<SearchInput
						type="search"
						placeholder="Search models…"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						aria-label="Search models"
					/>
				</SearchBox>

				{showPick && pick && (
					<Pick aria-labelledby="pick-name">
						<PickLabel>
							<Icon name="auto_awesome" size={12} />
							{ramGb ? "Best for this device" : "A good place to start"}
						</PickLabel>
						<PickHead>
							<PickName id="pick-name">{pick.name}</PickName>
							<CardSize>{pick.size_label}</CardSize>
						</PickHead>
						<PickText>{pick.description}</PickText>
						<MeterRow>
							<ModelMeters quality={pick.quality} speed={pick.speed} />
							{pick.reasoning !== "none" && <Tag>Can think</Tag>}
						</MeterRow>
						<PickActions>
							<PickButton type="button" onClick={() => download(pick, deviceMemory)}>
								<Icon name="download" size={18} />
								Download · {pick.size_label}
							</PickButton>
							<PickDetails type="button" onClick={() => openModel(pick)}>
								Details
							</PickDetails>
						</PickActions>
						{ramGb && (
							<PickReason>
								<Icon name="check_circle" size={13} />
								Chosen for your {ramGb} GB of memory, with room to spare
							</PickReason>
						)}
					</Pick>
				)}

				<SectionRow>
					<SectionTitle>All models</SectionTitle>
					{freeSpace && (
						<StorageHint>
							<Icon name="storage" size={13} />
							{freeSpace} GB free
						</StorageHint>
					)}
				</SectionRow>

				<Chips role="group" aria-label="Filter by type">
					{FILTERS.map((f, i) => (
						<Chip
							key={f}
							type="button"
							$active={i === filter}
							aria-pressed={i === filter}
							onClick={() => setFilter(i)}
						>
							{f}
						</Chip>
					))}
				</Chips>

				{catalogStatus === "error" ? (
					<CatalogError role="alert">
						<Icon name="error_outline" size={32} color={tokens.colors.error} />
						<CatalogErrorTitle>Couldn't load models</CatalogErrorTitle>
						<CatalogErrorMessage>{catalogError}</CatalogErrorMessage>
						<RetryButton type="button" onClick={loadCatalog}>
							<Icon name="refresh" size={16} />
							Try again
						</RetryButton>
					</CatalogError>
				) : catalogStatus === "loading" ? (
					<Cards aria-busy="true" aria-label="Loading models">
						{[1, 2, 3, 4].map((i) => (
							<SkeletonCard key={i}>
								<SkeletonLine $w="45%" $h="16px" style={{ marginBottom: "8px" }} />
								<SkeletonLine $w="95%" $h="12px" style={{ marginBottom: "6px" }} />
								<SkeletonLine $w="60%" $h="12px" />
							</SkeletonCard>
						))}
					</Cards>
				) : filtered.length === 0 ? (
					<EmptyState
						art="search"
						message="No models match"
						subtitle="Try a different search or filter."
					/>
				) : (
					<>
						<Cards>
							{filtered.map((m, i) => {
								const fit = modelFit(m, deviceMemory);
								const warn = (fit === "tight" || fit === "too_big") && !installed.has(m.id);
								return (
									<Card
										key={m.id}
										type="button"
										onClick={() => openModel(m)}
										style={{ animationDelay: `${i * 40}ms` }}
									>
										<CardTop>
											<CardName>
												{m.name}
												<CardMaker>{m.company}</CardMaker>
											</CardName>
											<CardSize>{m.size_label}</CardSize>
										</CardTop>
										<CardDesc>{m.description}</CardDesc>
										<CardBottom>
											<MeterRow style={{ marginTop: 0 }}>
												<ModelMeters quality={m.quality} speed={m.speed} />
												{m.reasoning === "always" && <Tag>Thinks first</Tag>}
												{m.reasoning === "optional" && <Tag>Can think</Tag>}
											</MeterRow>
											{statusBadge(m)}
										</CardBottom>
										{warn && (
											<FitNote $severe={fit === "too_big"}>
												<Icon name="warning" size={12} />
												{fitSummary(m, deviceMemory)}
											</FitNote>
										)}
									</Card>
								);
							})}
						</Cards>
						<Footnote>
							Quality and speed compare the models in this list with each other. Use the speed test
							in My Models to measure one on this device.
						</Footnote>
					</>
				)}
			</Page>
		</AppLayout>
	);
}
