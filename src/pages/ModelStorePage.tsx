import { AppLayout } from "@/components/layout/AppLayout";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { OfflineBanner } from "@/components/ui/OfflineBanner";
import { useDownloads } from "@/context/DownloadContext";
import { modelService, settingsService } from "@/services";
import type { ModelInfo } from "@/services/types";
import { tokens } from "@/theme/tokens";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled, { keyframes } from "styled-components";

const FILTERS = ["All", "Popular", "Code", "Fast", "Tiny"];

/* ── Styles ── */

const Page = styled.div`
  padding: 1.25rem;
`;

const SearchBox = styled.div`
  position: relative;
  margin-bottom: 0.75rem;
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

const Chips = styled.div`
  display: flex;
  gap: 0.375rem;
  overflow-x: auto;
  margin-bottom: 1.25rem;
  &::-webkit-scrollbar { display: none; }
  scrollbar-width: none;
`;

const Chip = styled.button<{ $active: boolean }>`
  flex-shrink: 0;
  padding: 0.5rem 0.875rem;
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

const slideIn = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
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
  display: flex;
  align-items: center;
  gap: 1rem;
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
  padding: 1rem;
  cursor: pointer;
  transition: background ${tokens.transitions.fast}, transform 0.1s ease;
  display: flex;
  align-items: center;
  gap: 1rem;
  animation: ${slideIn} 0.3s ease-out both;

  &:hover { background: ${tokens.colors.surfaceContainerHigh}; }
  &:active { transform: scale(0.99); }
`;

const CardInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const CardName = styled.h3`
  font-family: ${tokens.typography.fontFamily.headline};
  font-size: ${tokens.typography.fontSize.md};
  font-weight: ${tokens.typography.fontWeight.bold};
  color: ${tokens.colors.onSurface};
  margin-bottom: 0.125rem;
`;

const CardDesc = styled.p`
  font-size: ${tokens.typography.fontSize.base};
  color: ${tokens.colors.onSurfaceVariant};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const CardRight = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.375rem;
  flex-shrink: 0;
`;

const CardSize = styled.span`
  font-size: ${tokens.typography.fontSize.sm};
  color: ${tokens.colors.onSurfaceVariant};
`;

const DlIcon = styled.div`
  width: 44px;
  height: 44px;
  border-radius: ${tokens.borderRadius.lg};
  background: ${tokens.colors.surfaceContainerHighest};
  display: flex;
  align-items: center;
  justify-content: center;
`;

/* ── Component ── */

const DownloadedBadge = styled.span`
  font-size: 10px;
  font-weight: ${tokens.typography.fontWeight.bold};
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.125rem 0.375rem;
  border-radius: ${tokens.borderRadius.sm};
  background: ${tokens.colors.secondary}18;
  color: ${tokens.colors.secondary};
`;

const DownloadingBadge = styled.span`
  font-size: 10px;
  font-weight: ${tokens.typography.fontWeight.bold};
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.15rem 0.5rem;
  border-radius: ${tokens.borderRadius.sm};
  background: ${tokens.colors.tertiary}22;
  color: ${tokens.colors.tertiary};
  border: 1px solid ${tokens.colors.tertiary}33;
`;

const RecommendedBadge = styled.span`
  font-size: 9px;
  font-weight: ${tokens.typography.fontWeight.bold};
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.15rem 0.375rem;
  border-radius: ${tokens.borderRadius.sm};
  background: linear-gradient(135deg, ${tokens.colors.primary}22, ${tokens.colors.secondary}22);
  color: ${tokens.colors.primary};
  border: 1px solid ${tokens.colors.primary}33;
`;

const StorageHint = styled.div`
  font-size: ${tokens.typography.fontSize.sm};
  color: ${tokens.colors.onSurfaceVariant};
  padding: 0.375rem 0.75rem;
  background: ${tokens.colors.surfaceContainerLow};
  border-radius: ${tokens.borderRadius.md};
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.375rem;
`;

export function ModelStorePage() {
	const navigate = useNavigate();
	const { downloads } = useDownloads();
	const [filter, setFilter] = useState(0);
	const [search, setSearch] = useState("");
	const [catalog, setCatalog] = useState<ModelInfo[]>([]);
	const [catalogStatus, setCatalogStatus] = useState<"loading" | "ready" | "error">("loading");
	const [catalogError, setCatalogError] = useState<string>("");
	const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set());
	const [freeSpace, setFreeSpace] = useState<string | null>(null);

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
		settingsService.getAvailableSpace().then((bytes) => {
			setFreeSpace((bytes / (1024 * 1024 * 1024)).toFixed(1));
		}).catch(() => {});
	}, [loadCatalog]);

	// Refresh downloaded IDs whenever downloads change (catches completed downloads)
	useEffect(() => {
		modelService.getDownloadedModels().then((models) => {
			setDownloadedIds(new Set(models.map((m) => m.id)));
		});
	}, [downloads]);

	const filtered = catalog.filter((m) => {
		const matchesSearch =
			!search ||
			m.name.toLowerCase().includes(search.toLowerCase()) ||
			m.description.toLowerCase().includes(search.toLowerCase());
		const matchesFilter = filter === 0 || m.tag === FILTERS[filter];
		return matchesSearch && matchesFilter;
	});

	const handleModelClick = (model: ModelInfo) => {
		if (downloads[model.id]?.status === "downloading" || downloads[model.id]?.status === "paused") {
			navigate(`/downloading?id=${encodeURIComponent(model.id)}`, { state: { model } });
		} else {
			// Pass model via state for fast first-paint; the ?id query lets the
			// detail page recover after a reload.
			navigate(`/store/model?id=${encodeURIComponent(model.id)}`, { state: { model } });
		}
	};

	return (
		<AppLayout title="Model Store">
			<OfflineBanner />
			<Page>
<SearchBox>
					<SearchIconWrap>
						<Icon name="search" size={18} />
					</SearchIconWrap>
					<SearchInput
						placeholder="Search models..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						aria-label="Search models"
					/>
				</SearchBox>

				<Chips>
					{FILTERS.map((f, i) => (
						<Chip key={f} $active={i === filter} onClick={() => setFilter(i)}>
							{f}
						</Chip>
					))}
				</Chips>

				{freeSpace && (
					<StorageHint>
						<Icon name="storage" size={14} color={tokens.colors.onSurfaceVariant} />
						{freeSpace} GB free on device
					</StorageHint>
				)}

				{catalogStatus === "error" ? (
					<CatalogError>
						<Icon name="error_outline" size={32} color={tokens.colors.error} />
						<CatalogErrorTitle>Couldn't load models</CatalogErrorTitle>
						<CatalogErrorMessage>{catalogError}</CatalogErrorMessage>
						<RetryButton type="button" onClick={loadCatalog}>
							<Icon name="refresh" size={16} color={tokens.colors.onPrimary} />
							Try again
						</RetryButton>
					</CatalogError>
				) : catalogStatus === "loading" ? (
					<Cards>
						{[1, 2, 3, 4].map((i) => (
							<SkeletonCard key={i} style={{ animationDelay: `${i * 80}ms` }}>
								<div style={{ flex: 1 }}>
									<SkeletonLine $w="60%" $h="16px" style={{ marginBottom: "6px" }} />
									<SkeletonLine $w="90%" $h="12px" />
								</div>
								<div>
									<SkeletonLine $w="48px" $h="12px" style={{ marginBottom: "6px" }} />
									<SkeletonLine $w="32px" $h="32px" />
								</div>
							</SkeletonCard>
						))}
					</Cards>
				) : filtered.length === 0 ? (
					<EmptyState message="No models match your search" />
				) : (
					<Cards>
						{filtered.map((m, i) => (
							<Card
								key={m.id}
								onClick={() => handleModelClick(m)}
								style={{ animationDelay: `${i * 50}ms` }}
							>
								<CardInfo>
									<CardName>
										{m.name}
										{m.id === "llama-3.2-1b" && !downloadedIds.has(m.id) && (
											<> <RecommendedBadge>Recommended</RecommendedBadge></>
										)}
									</CardName>
									<CardDesc>{m.description}</CardDesc>
								</CardInfo>
								<CardRight>
									<CardSize>{m.size_label}</CardSize>
									{downloadedIds.has(m.id) ? (
										<DownloadedBadge>Downloaded</DownloadedBadge>
									) : downloads[m.id]?.status === "downloading" ? (
										<DownloadingBadge>
											{Math.round((downloads[m.id].downloadedBytes / Math.max(downloads[m.id].totalBytes, 1)) * 100)}%
										</DownloadingBadge>
									) : downloads[m.id]?.status === "paused" ? (
										<DownloadingBadge>Paused</DownloadingBadge>
									) : (
										<DlIcon>
											<Icon
												name="download"
												size={18}
												color={tokens.colors.primary}
											/>
										</DlIcon>
									)}
								</CardRight>
							</Card>
						))}
					</Cards>
				)}
			</Page>
		</AppLayout>
	);
}
