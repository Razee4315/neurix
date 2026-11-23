import { AppLayout } from "@/components/layout/AppLayout";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { ModelMeters } from "@/components/ui/Meter";
import { OfflineBanner } from "@/components/ui/OfflineBanner";
import { useAppContext } from "@/context/AppContext";
import { useDownloads } from "@/context/DownloadContext";
import { modelService, settingsService } from "@/services";
import type { ModelInfo } from "@/services/types";
import { alpha } from "@/theme/alpha";
import { tokens } from "@/theme/tokens";
import { formatGB } from "@/utils/format";
import {
	type Fit,
	fitSummary,
	modelFit,
	nominalRamGb,
	recommendModel,
} from "@/utils/modelFit";
import { useModelDownload } from "@/utils/useModelDownload";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled, { keyframes } from "styled-components";

// Matches the tags in src-tauri/src/models/catalog.rs.
const FILTERS = ["All", "Tiny", "Fast", "Balanced", "Smart", "Specialist"];

const FALLBACK_DESKTOP_RAM_BYTES = 8 * 1024 ** 3;

function quantSummary(quantization: string): string {
	const code = quantization.split(" ")[0] || quantization;
	if (code.startsWith("Q4_K")) return `${code} · balanced speed/quality`;
	if (code.startsWith("Q4_0")) return `${code} · fast 4-bit QAT`;
	if (code.startsWith("Q5_K")) return `${code} · higher accuracy 5-bit`;
	if (code.startsWith("Q6_K")) return `${code} · near-lossless 6-bit`;
	if (code.startsWith("Q8_0")) return `${code} · max 8-bit fidelity`;
	return `${code} · local GGUF`;
}

function fitBadgeMeta(fit: Fit): {
	label: "Fits comfortably" | "Tight fit" | "May be slow";
	tone: "good" | "tight" | "slow";
} {
	if (fit === "too_big") return { label: "May be slow", tone: "slow" };
	if (fit === "tight") return { label: "Tight fit", tone: "tight" };
	return { label: "Fits comfortably", tone: "good" };
}

/* ── Styles ── */

const Page = styled.div`
	padding: 1.25rem;
	max-width: 46rem;
	margin: 0 auto;
`;

const AirGapBanner = styled.div`
	display: flex;
	align-items: center;
	justify-content: space-between;
	flex-wrap: wrap;
	gap: 0.75rem;
	margin-bottom: 1rem;
	padding: 0.75rem 1rem;
	border-radius: ${tokens.borderRadius.lg};
	background: ${alpha(tokens.colors.secondary, "14")};
	border: 1px solid ${alpha(tokens.colors.secondary, "45")};
	color: ${tokens.colors.onSurface};
	font-size: ${tokens.typography.fontSize.sm};
`;

const AirGapText = styled.div`
	display: flex;
	align-items: center;
	gap: 0.5rem;
	flex: 1;
	min-width: 14rem;

	strong {
		font-weight: ${tokens.typography.fontWeight.bold};
		color: ${tokens.colors.secondary};
	}
`;

const AirGapBtn = styled.button`
	padding: 0.375rem 0.75rem;
	border-radius: ${tokens.borderRadius.md};
	border: 1px solid ${tokens.colors.outlineVariant};
	background: ${tokens.colors.surfaceContainerHigh};
	color: ${tokens.colors.onSurface};
	font-size: ${tokens.typography.fontSize.xs};
	font-weight: ${tokens.typography.fontWeight.semibold};
	cursor: pointer;

	&:hover {
		background: ${tokens.colors.surfaceContainerHighest};
	}
`;

const TopBar = styled.div`
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 0.625rem;
	margin-bottom: 1rem;
`;

const SearchBox = styled.div`
	position: relative;
	flex: 1 1 15rem;
	min-width: 0;
`;

const SearchInput = styled.input`
	width: 100%;
	height: 44px;
	padding: 0 1rem 0 2.5rem;
	background: ${tokens.colors.surfaceContainerHighest};
	border: 1px solid ${tokens.colors.outlineVariant};
	border-radius: ${tokens.borderRadius.lg};
	font-size: ${tokens.typography.fontSize.base};
	color: ${tokens.colors.onSurface};
	outline: none;

	&::placeholder {
		color: ${tokens.colors.outline};
	}
	&:focus {
		border-color: ${tokens.colors.primary};
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

const AddHfHeaderBtn = styled.button`
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 0.4rem;
	height: 44px;
	padding: 0 0.875rem;
	border-radius: ${tokens.borderRadius.lg};
	border: 1px solid ${alpha(tokens.colors.primary, "55")};
	background: ${alpha(tokens.colors.primary, "14")};
	color: ${tokens.colors.primary};
	font-size: ${tokens.typography.fontSize.sm};
	font-weight: ${tokens.typography.fontWeight.semibold};
	white-space: nowrap;
	cursor: pointer;
	transition: all ${tokens.transitions.fast};

	&:hover {
		background: ${alpha(tokens.colors.primary, "24")};
	}
	&:active {
		transform: scale(0.98);
	}
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
  background: ${tokens.colors.surfaceContainerLow};
  border: 1.5px solid ${tokens.colors.primary};
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
  color: ${tokens.colors.onPrimaryFixed};
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

/* Meters on the left, tags and status on the right. On a narrow phone the
   right group moves under the meters as one piece rather than leaving a
   lone tag on its own line. */
const CardBottom = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 0.75rem;
  margin-top: 0.5rem;
`;

const CardMeters = styled.div`
  display: flex;
  align-items: center;
  gap: 0.875rem;
`;

const CardTags = styled.div`
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 0.375rem;
	margin-left: auto;

	&:empty {
		display: none;
	}
`;

const FitBadge = styled.span<{ $tone: "good" | "tight" | "slow" }>`
	display: inline-flex;
	align-items: center;
	gap: 0.25rem;
	font-size: 10px;
	font-weight: ${tokens.typography.fontWeight.bold};
	padding: 0.175rem 0.45rem;
	border-radius: ${tokens.borderRadius.sm};
	white-space: nowrap;
	color: ${({ $tone }) =>
		$tone === "good"
			? tokens.colors.primary
			: $tone === "tight"
				? tokens.colors.secondary
				: tokens.colors.error};
	background: ${({ $tone }) =>
		$tone === "good"
			? alpha(tokens.colors.primary, "16")
			: $tone === "tight"
				? alpha(tokens.colors.secondary, "18")
				: alpha(tokens.colors.error, "18")};
`;

const QuantTag = styled.span`
	font-family: ${tokens.typography.fontFamily.mono};
	font-size: 10px;
	font-weight: ${tokens.typography.fontWeight.medium};
	padding: 0.15rem 0.45rem;
	border-radius: ${tokens.borderRadius.sm};
	color: ${tokens.colors.onSurfaceVariant};
	background: ${tokens.colors.surfaceContainerHigh};
	white-space: nowrap;
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
	color: ${({ $severe }) =>
		$severe ? tokens.colors.error : tokens.colors.tertiary};
`;

const Footnote = styled.p`
	margin-top: 1rem;
	font-size: ${tokens.typography.fontSize.xs};
	line-height: ${tokens.typography.lineHeight.relaxed};
	color: ${tokens.colors.outline};
	text-align: center;
`;

/* The way to models the store doesn't list: a link from Hugging Face. */
const AddCard = styled.button`
	width: 100%;
	display: flex;
	align-items: center;
	gap: 0.875rem;
	margin-top: 1.25rem;
	padding: 1rem;
	border-radius: ${tokens.borderRadius.lg};
	border: 1px dashed ${tokens.colors.outlineVariant};
	background: transparent;
	color: ${tokens.colors.onSurface};
	text-align: left;
	cursor: pointer;

	&:hover {
		background: ${tokens.colors.surfaceContainerLow};
	}
`;

const AddIcon = styled.span`
	display: grid;
	place-items: center;
	width: 40px;
	height: 40px;
	flex-shrink: 0;
	border-radius: ${tokens.borderRadius.md};
	background: ${alpha(tokens.colors.primary, "18")};
	color: ${tokens.colors.primary};
`;

const AddText = styled.span`
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 0.125rem;

	strong {
		font-weight: ${tokens.typography.fontWeight.semibold};
	}
	span {
		font-size: ${tokens.typography.fontSize.sm};
		color: ${tokens.colors.onSurfaceVariant};
		line-height: ${tokens.typography.lineHeight.relaxed};
	}
`;

function AddFromLink({ onClick }: { onClick: () => void }) {
	return (
		<AddCard type="button" onClick={onClick}>
			<AddIcon>
				<Icon name="link" size={20} />
			</AddIcon>
			<AddText>
				<strong>Add a model from Hugging Face</strong>
				<span>
					Paste a link to a GGUF chat model and Neurix checks it will run here.
				</span>
			</AddText>
			<Icon name="chevron_right" size={18} color={tokens.colors.outline} />
		</AddCard>
	);
}

/* ── Component ── */

export function ModelStorePage() {
	const navigate = useNavigate();
	const { settings } = useAppContext();
	const { downloads, installedVersion } = useDownloads();
	const download = useModelDownload();
	const [filter, setFilter] = useState(0);
	const [search, setSearch] = useState("");
	const [catalog, setCatalog] = useState<ModelInfo[]>([]);
	const [catalogStatus, setCatalogStatus] = useState<
		"loading" | "ready" | "error"
	>("loading");
	const [catalogError, setCatalogError] = useState<string>("");
	const [downloadedIds, setDownloadedIds] = useState<Set<string> | null>(null);
	const [freeSpace, setFreeSpace] = useState<string | null>(null);
	const [deviceMemory, setDeviceMemory] = useState<number | null>(null);

	const loadCatalog = useCallback(() => {
		setCatalogStatus("loading");
		setCatalogError("");
		modelService
			.getCatalog()
			.then((c) => {
				setCatalog(c);
				setCatalogStatus("ready");
			})
			.catch((e) => {
				setCatalogError(
					typeof e === "string"
						? e
						: (e?.message ?? "Could not load model catalog"),
				);
				setCatalogStatus("error");
			});
	}, []);

	useEffect(() => {
		loadCatalog();
		settingsService
			.getDeviceInfo()
			.then((info) => setDeviceMemory(info.total_memory_bytes))
			.catch(() => {});
	}, [loadCatalog]);

	// Installed models and free space change only when a download finishes
	// or is discarded — not on every progress tick.
	// biome-ignore lint/correctness/useExhaustiveDependencies: installedVersion is the refresh trigger
	useEffect(() => {
		modelService
			.getDownloadedModels()
			.then((models) => setDownloadedIds(new Set(models.map((m) => m.id))))
			.catch(() => setDownloadedIds(new Set()));
		settingsService
			.getAvailableSpace()
			.then((bytes) => setFreeSpace(formatGB(bytes)))
			.catch(() => {});
	}, [installedVersion]);

	const installed = downloadedIds ?? new Set<string>();

	// Superseded models stay out of the store unless the user already has
	// one, in which case its page should still be reachable. Models the user
	// added live in My Models, not here.
	const offered = useMemo(
		() =>
			catalog.filter(
				(m) => m.tag !== "Added" && (!m.legacy || downloadedIds?.has(m.id)),
			),
		[catalog, downloadedIds],
	);

	const pick = useMemo(
		() => recommendModel(catalog, deviceMemory),
		[catalog, deviceMemory],
	);

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
		const inProgress =
			downloads[model.id] && downloads[model.id].status !== "finished";
		// The ?id query lets either page recover after a reload.
		navigate(
			`${inProgress ? "/downloading" : "/store/model"}?id=${encodeURIComponent(model.id)}`,
			{
				state: { model },
			},
		);
	};

	const statusBadge = (m: ModelInfo) => {
		const dl = downloads[m.id];
		if (installed.has(m.id)) return <Badge $tone="ok">Installed</Badge>;
		if (dl?.status === "downloading") {
			const pct = Math.round(
				(dl.downloadedBytes / Math.max(dl.totalBytes, 1)) * 100,
			);
			return <Badge $tone="busy">{pct}%</Badge>;
		}
		if (dl?.status === "verifying")
			return <Badge $tone="busy">Checking…</Badge>;
		if (dl?.status === "paused") return <Badge $tone="busy">Paused</Badge>;
		if (dl?.status === "failed") return <Badge $tone="busy">Failed</Badge>;
		if (m.legacy) return <Badge $tone="muted">Legacy</Badge>;
		return (
			<Icon name="chevron_right" size={18} color={tokens.colors.outline} />
		);
	};

	// The pick is for someone deciding what to get. Once they are searching
	// or filtering, or already have it, it is in the way.
	const pickBusy = pick
		? downloads[pick.id] && downloads[pick.id].status !== "finished"
		: false;
	const showPick =
		catalogStatus === "ready" &&
		downloadedIds !== null &&
		pick !== null &&
		!installed.has(pick.id) &&
		!pickBusy &&
		!query &&
		filter === 0;
	const ramGb = nominalRamGb(deviceMemory);
	const effectiveMemory = deviceMemory ?? FALLBACK_DESKTOP_RAM_BYTES;

	return (
		<AppLayout title="Model Store">
			<OfflineBanner />
			<Page>
				{settings?.air_gap && (
					<AirGapBanner role="status">
						<AirGapText>
							<Icon
								name="enhanced_encryption"
								size={16}
								color={tokens.colors.secondary}
							/>
							<span>
								<strong>Air-Gap Mode Active:</strong> Outbound model downloads
								are locked. Installed models in My Models continue to run 100%
								offline.
							</span>
						</AirGapText>
						<AirGapBtn type="button" onClick={() => navigate("/settings")}>
							Manage Air-Gap
						</AirGapBtn>
					</AirGapBanner>
				)}

				<TopBar>
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
					<AddHfHeaderBtn
						type="button"
						onClick={() => navigate("/store/add")}
						aria-label="Add model from Hugging Face"
					>
						<Icon name="add" size={16} />
						Add from Hugging Face
					</AddHfHeaderBtn>
				</TopBar>

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
							<QuantTag>{quantSummary(pick.quantization)}</QuantTag>
							<FitBadge $tone="good">
								<Icon name="check_circle" size={11} />
								Fits comfortably
							</FitBadge>
							{pick.reasoning !== "none" && <Tag>Can think</Tag>}
						</MeterRow>
						<PickActions>
							<PickButton
								type="button"
								onClick={() => download(pick, deviceMemory)}
							>
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
								<SkeletonLine
									$w="45%"
									$h="16px"
									style={{ marginBottom: "8px" }}
								/>
								<SkeletonLine
									$w="95%"
									$h="12px"
									style={{ marginBottom: "6px" }}
								/>
								<SkeletonLine $w="60%" $h="12px" />
							</SkeletonCard>
						))}
					</Cards>
				) : filtered.length === 0 ? (
					<>
						<EmptyState
							art="search"
							message="No models match"
							subtitle="Try a different search or filter, or add a model from Hugging Face."
						/>
						<AddFromLink onClick={() => navigate("/store/add")} />
					</>
				) : (
					<>
						<Cards>
							{filtered.map((m, i) => {
								const rawFit = modelFit(m, deviceMemory);
								const resolvedFit =
									rawFit === "unknown"
										? modelFit(m, effectiveMemory)
										: rawFit;
								const fitMeta = fitBadgeMeta(resolvedFit);
								const warn =
									(rawFit === "tight" || rawFit === "too_big") &&
									!installed.has(m.id);
								return (
									<Card
										key={m.id}
										type="button"
										onClick={() => openModel(m)}
										aria-label={`${m.name}, ${m.size_label}`}
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
											<CardMeters>
												<ModelMeters quality={m.quality} speed={m.speed} />
												<QuantTag>{quantSummary(m.quantization)}</QuantTag>
											</CardMeters>
											<CardTags>
												<FitBadge $tone={fitMeta.tone}>
													<Icon
														name={
															fitMeta.tone === "good"
																? "check_circle"
																: "warning"
														}
														size={11}
													/>
													{fitMeta.label}
												</FitBadge>
												{m.reasoning === "always" && <Tag>Thinks first</Tag>}
												{m.reasoning === "optional" && <Tag>Can think</Tag>}
												{statusBadge(m)}
											</CardTags>
										</CardBottom>
										{warn && (
											<FitNote $severe={rawFit === "too_big"}>
												<Icon name="warning" size={12} />
												{fitSummary(m, deviceMemory)}
											</FitNote>
										)}
									</Card>
								);
							})}
						</Cards>
						<Footnote>
							Quality and speed compare the models in this list with each other.
							Use the speed test in My Models to measure one on this device.
						</Footnote>
						<AddFromLink onClick={() => navigate("/store/add")} />
					</>
				)}
			</Page>
		</AppLayout>
	);
}
