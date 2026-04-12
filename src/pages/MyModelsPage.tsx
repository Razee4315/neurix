import { AppLayout } from "@/components/layout/AppLayout";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { useAppContext } from "@/context/AppContext";
import { useDownloads } from "@/context/DownloadContext";
import { modelService, settingsService } from "@/services";
import type { DownloadedModel, ModelInfo, StorageInfo } from "@/services/types";
import { tokens } from "@/theme/tokens";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled, { keyframes } from "styled-components";

/* ── Styles ── */

const Page = styled.div`
  padding: 1.25rem;
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

  &::placeholder { color: ${tokens.colors.outline}; }
  &:focus { box-shadow: inset 0 -2px 0 ${tokens.colors.primary}; }
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

/* ── Storage ── */

const StorageSection = styled.div`
  margin-bottom: 1.5rem;
`;

const StorageHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 0.5rem;
`;

const StorageLabel = styled.span`
  font-size: ${tokens.typography.fontSize.sm};
  color: ${tokens.colors.onSurfaceVariant};
`;

const StorageValue = styled.span`
  font-family: ${tokens.typography.fontFamily.headline};
  font-size: ${tokens.typography.fontSize.xl};
  font-weight: ${tokens.typography.fontWeight.bold};
  color: ${tokens.colors.onSurface};

  span {
    font-size: ${tokens.typography.fontSize.base};
    font-weight: ${tokens.typography.fontWeight.regular};
    color: ${tokens.colors.onSurfaceVariant};
  }
`;

const StorageBar = styled.div`
  width: 100%;
  height: 6px;
  background: ${tokens.colors.surfaceContainerHighest};
  border-radius: ${tokens.borderRadius.circle};
  overflow: hidden;
`;

const barFillIn = keyframes`
  from { width: 0%; }
`;

const StorageFill = styled.div<{ $pct: number }>`
  height: 100%;
  width: ${({ $pct }) => $pct}%;
  background: ${tokens.colors.primary};
  border-radius: ${tokens.borderRadius.circle};
  animation: ${barFillIn} 0.6s ease-out both;
`;

/* ── Model List ── */

const ListHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
`;

const ListTitle = styled.h2`
  font-family: ${tokens.typography.fontFamily.headline};
  font-size: ${tokens.typography.fontSize.md};
  font-weight: ${tokens.typography.fontWeight.medium};
  color: ${tokens.colors.onSurface};
`;

const AddButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  background: none;
  border: none;
  color: ${tokens.colors.primary};
  font-size: ${tokens.typography.fontSize.sm};
  font-weight: ${tokens.typography.fontWeight.medium};
  cursor: pointer;
  transition: opacity ${tokens.transitions.fast};

  &:hover { opacity: 0.7; }
  &:active { transform: scale(0.95); }
`;

const slideIn = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
`;

const Cards = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const Card = styled.div<{ $active: boolean }>`
  background: ${({ $active }) =>
		$active
			? tokens.colors.surfaceContainerHigh
			: tokens.colors.surfaceContainerLow};
  border-radius: ${tokens.borderRadius.lg};
  padding: 1rem;
  animation: ${slideIn} 0.3s ease-out both;
  border: 2px solid ${({ $active }) =>
		$active ? tokens.colors.primary : "transparent"};
  ${({ $active }) => $active && `
    box-shadow: 0 0 0 1px ${tokens.colors.primary}20, ${tokens.shadows.ambient};
  `}
`;

const CardTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
`;

const CardName = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const ModelName = styled.span`
  font-family: ${tokens.typography.fontFamily.headline};
  font-size: ${tokens.typography.fontSize.md};
  font-weight: ${tokens.typography.fontWeight.bold};
  color: ${tokens.colors.onSurface};
`;

const ActiveBadge = styled.span`
  font-size: ${tokens.typography.fontSize.xs};
  font-weight: ${tokens.typography.fontWeight.bold};
  padding: 0.25rem 0.5rem;
  border-radius: ${tokens.borderRadius.md};
  background: linear-gradient(135deg, ${tokens.colors.primary}, ${tokens.colors.primaryContainer});
  color: ${tokens.colors.onPrimaryFixed};
`;

const CardMeta = styled.div`
  display: flex;
  gap: 0.75rem;
  font-size: ${tokens.typography.fontSize.sm};
  color: ${tokens.colors.onSurfaceVariant};
  margin-bottom: 0.75rem;
`;

const CardActions = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const UseBtn = styled.button<{ $active: boolean }>`
  flex: 1;
  height: 44px;
  border-radius: ${tokens.borderRadius.lg};
  border: none;
  font-size: ${tokens.typography.fontSize.sm};
  font-weight: ${tokens.typography.fontWeight.bold};
  cursor: pointer;
  transition: all ${tokens.transitions.fast};

  ${({ $active }) =>
		$active
			? `
    background: linear-gradient(135deg, ${tokens.colors.primary}, ${tokens.colors.primaryContainer});
    color: ${tokens.colors.onPrimaryFixed};
  `
			: `
    background: ${tokens.colors.surfaceContainerHighest};
    color: ${tokens.colors.onSurface};
    &:hover { background: ${tokens.colors.surfaceBright}; }
  `}

  &:active { transform: scale(0.98); }
`;

const DeleteBtn = styled.button`
  width: 44px;
  height: 44px;
  border-radius: ${tokens.borderRadius.lg};
  border: none;
  background: ${tokens.colors.error}12;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background ${tokens.transitions.fast};

  &:hover { background: ${tokens.colors.error}22; }
  &:active { transform: scale(0.95); }
`;

/* ── Downloading Section ── */

const DownloadSection = styled.div`
  margin-bottom: 1.5rem;
`;

const SectionTitle = styled.h2`
  font-family: ${tokens.typography.fontFamily.headline};
  font-size: ${tokens.typography.fontSize.md};
  font-weight: ${tokens.typography.fontWeight.medium};
  color: ${tokens.colors.onSurface};
  margin-bottom: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const DownloadCard = styled.div`
  background: ${tokens.colors.surfaceContainerLow};
  border-radius: ${tokens.borderRadius.lg};
  padding: 1rem;
  margin-bottom: 0.5rem;
  border: 1px solid ${tokens.colors.tertiary}30;
`;

const DownloadCardTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
`;

const DownloadName = styled.span`
  font-family: ${tokens.typography.fontFamily.headline};
  font-size: ${tokens.typography.fontSize.md};
  font-weight: ${tokens.typography.fontWeight.bold};
  color: ${tokens.colors.onSurface};
`;

const DownloadStatus = styled.span<{ $status: string }>`
  font-size: ${tokens.typography.fontSize.xs};
  font-weight: ${tokens.typography.fontWeight.semibold};
  padding: 0.25rem 0.5rem;
  border-radius: ${tokens.borderRadius.md};
  background: ${({ $status }) => {
		switch ($status) {
			case "downloading": return tokens.colors.tertiary + "22";
			case "paused": return tokens.colors.outline + "22";
			case "failed": return tokens.colors.error + "22";
			default: return tokens.colors.surfaceContainerHighest;
		}
	}};
  color: ${({ $status }) => {
		switch ($status) {
			case "downloading": return tokens.colors.tertiary;
			case "paused": return tokens.colors.onSurfaceVariant;
			case "failed": return tokens.colors.error;
			default: return tokens.colors.onSurfaceVariant;
		}
	}};
`;

const ProgressBarContainer = styled.div`
  width: 100%;
  height: 8px;
  background: ${tokens.colors.surfaceContainerHighest};
  border-radius: ${tokens.borderRadius.circle};
  overflow: hidden;
  margin-bottom: 0.5rem;
`;

const ProgressBarFill = styled.div<{ $pct: number }>`
  height: 100%;
  width: ${({ $pct }) => $pct}%;
  background: linear-gradient(90deg, ${tokens.colors.tertiary}, ${tokens.colors.primary});
  border-radius: ${tokens.borderRadius.circle};
  transition: width 0.3s ease;
`;

const DownloadMeta = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: ${tokens.typography.fontSize.sm};
  color: ${tokens.colors.onSurfaceVariant};
  margin-bottom: 0.75rem;
`;

const DownloadSpeed = styled.span`
  font-family: ${tokens.typography.fontFamily.mono};
  font-size: ${tokens.typography.fontSize.xs};
  color: ${tokens.colors.tertiary};
`;

const DownloadActions = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const DownloadActionBtn = styled.button<{ $primary?: boolean }>`
  flex: 1;
  height: 44px;
  border-radius: ${tokens.borderRadius.lg};
  border: none;
  font-size: ${tokens.typography.fontSize.sm};
  font-weight: ${tokens.typography.fontWeight.semibold};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  transition: all ${tokens.transitions.fast};

  ${({ $primary }) =>
		$primary
			? `
    background: ${tokens.colors.tertiary}22;
    color: ${tokens.colors.tertiary};
    &:hover { background: ${tokens.colors.tertiary}33; }
  `
			: `
    background: ${tokens.colors.surfaceContainerHighest};
    color: ${tokens.colors.onSurfaceVariant};
    &:hover { background: ${tokens.colors.surfaceBright}; }
  `}

  &:active { transform: scale(0.98); }
`;

const DownloadError = styled.div`
  font-size: ${tokens.typography.fontSize.sm};
  color: ${tokens.colors.error};
  margin-bottom: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.375rem;
`;

/* ── Loading Overlay ── */

const overlayFadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const loadingPulse = keyframes`
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
`;

const loadingSpin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const glowRing = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 ${tokens.colors.primary}4d; }
  50% { box-shadow: 0 0 20px 4px ${tokens.colors.primary}26; }
`;

const LoadingOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 999;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  background: ${tokens.colors.background}f2;
  padding: 2rem;
  animation: ${overlayFadeIn} 0.2s ease-out both;
`;

const Spinner = styled.div`
  width: 48px;
  height: 48px;
  border: 3px solid ${tokens.colors.surfaceContainerHighest};
  border-top-color: ${tokens.colors.primary};
  border-radius: 50%;
  animation: ${loadingSpin} 0.8s linear infinite, ${glowRing} 2s ease-in-out infinite;
`;

const LoadingTitle = styled.h2`
  font-family: ${tokens.typography.fontFamily.headline};
  font-size: ${tokens.typography.fontSize.xl};
  font-weight: ${tokens.typography.fontWeight.bold};
  color: ${tokens.colors.onSurface};
  text-align: center;
`;

const LoadingSubtitle = styled.p`
  font-size: ${tokens.typography.fontSize.base};
  color: ${tokens.colors.onSurfaceVariant};
  text-align: center;
  animation: ${loadingPulse} 2s ease-in-out infinite;
`;

/* ── Pull to Refresh ── */

const PullIndicator = styled.div<{ $visible: boolean }>`
  display: flex;
  justify-content: center;
  padding: ${({ $visible }) => $visible ? "0.75rem 0" : "0"};
  height: ${({ $visible }) => $visible ? "auto" : "0"};
  overflow: hidden;
  transition: all 0.2s ease;
`;

const RefreshSpinner = styled.div`
  width: 20px;
  height: 20px;
  border: 2px solid ${tokens.colors.surfaceContainerHighest};
  border-top-color: ${tokens.colors.primary};
  border-radius: 50%;
  animation: ${loadingSpin} 0.8s linear infinite;
`;

/* ── Component ── */

function formatStorageGB(bytes: number): string {
	return (bytes / (1024 * 1024 * 1024)).toFixed(1);
}

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatSpeed(bps: number): string {
	if (bps < 1024) return `${bps} B/s`;
	if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KB/s`;
	return `${(bps / (1024 * 1024)).toFixed(1)} MB/s`;
}

export function MyModelsPage() {
	const navigate = useNavigate();
	const { activeModel, refreshActiveModel } = useAppContext();
	const { downloads, pauseDownload, resumeDownload, cancelDownload } = useDownloads();
	const { showConfirm, showAlert } = useConfirm();
	const [search, setSearch] = useState("");
	const [models, setModels] = useState<DownloadedModel[]>([]);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const pullStartRef = useRef(0);
	const pageRef = useRef<HTMLDivElement>(null);
	const [storage, setStorage] = useState<StorageInfo>({ used_bytes: 0, models_count: 0 });
	const [availableSpace, setAvailableSpace] = useState<number | null>(null);
	const [catalog, setCatalog] = useState<ModelInfo[]>([]);

	const refresh = useCallback(async () => {
		const [downloaded, info, available, catalogData] = await Promise.all([
			modelService.getDownloadedModels(),
			settingsService.getStorageInfo(),
			settingsService.getAvailableSpace().catch(() => null),
			modelService.getCatalog().catch(() => []),
		]);
		setModels(downloaded);
		setStorage(info);
		setAvailableSpace(available);
		setCatalog(catalogData);
	}, []);

	useEffect(() => {
		refresh();
	}, [refresh]);

	const handlePullRefresh = async () => {
		if (navigator.vibrate) navigator.vibrate(8);
		setIsRefreshing(true);
		await refresh();
		setIsRefreshing(false);
	};

	const handleTouchStart = (e: React.TouchEvent) => {
		pullStartRef.current = e.touches[0].clientY;
	};

	const handleTouchEnd = (e: React.TouchEvent) => {
		const diff = e.changedTouches[0].clientY - pullStartRef.current;
		const el = pageRef.current?.parentElement;
		if (diff > 80 && el && el.scrollTop <= 0 && !isRefreshing) {
			handlePullRefresh();
		}
	};

	const filtered = models.filter(
		(m) => !search || m.name.toLowerCase().includes(search.toLowerCase()),
	);

	const [loadingModelId, setLoadingModelId] = useState<string | null>(null);
	const [loadingModelName, setLoadingModelName] = useState<string | null>(null);

	const handleUse = async (model: DownloadedModel) => {
		if (activeModel === model.name) {
			navigate("/chat", { state: { freshChat: true } });
			return;
		}
		setLoadingModelId(model.id);
		setLoadingModelName(model.name);
		try {
			await modelService.loadModel(model.id);
			await refreshActiveModel();
			if (navigator.vibrate) navigator.vibrate(15);
			navigate("/chat", { state: { freshChat: true } });
		} catch (err) {
			showAlert("Load Failed", String(err));
		} finally {
			setLoadingModelId(null);
			setLoadingModelName(null);
		}
	};

	const handleDelete = async (model: DownloadedModel) => {
		const isActive = activeModel === model.name;
		const message = isActive
			? `"${model.name}" is currently loaded. Deleting it will unload the model and free ${model.size_label} of storage.`
			: `Delete "${model.name}"? This will free ${model.size_label} of storage.`;

		const ok = await showConfirm({
			title: isActive ? "Delete Active Model" : "Delete Model",
			message,
			confirmLabel: "Delete",
			cancelLabel: "Cancel",
			danger: true,
		});
		if (!ok) return;
		if (navigator.vibrate) navigator.vibrate(15);
		await modelService.deleteModel(model.id);
		await refresh();
		await refreshActiveModel();
	};

	const usedGB = formatStorageGB(storage.used_bytes);
	const storageKnown = availableSpace !== null;
	const totalSpace = storageKnown ? storage.used_bytes + availableSpace : 0;
	const usagePercent = storageKnown && totalSpace > 0 ? (storage.used_bytes / totalSpace) * 100 : 0;
	const freeGB = storageKnown ? formatStorageGB(availableSpace) : null;

	return (
		<AppLayout title="My Models">
			{loadingModelName && (
				<LoadingOverlay>
					<Spinner />
					<LoadingTitle>Loading {loadingModelName}</LoadingTitle>
					<LoadingSubtitle>This may take a moment...</LoadingSubtitle>
				</LoadingOverlay>
			)}
			<Page ref={pageRef} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
				<PullIndicator $visible={isRefreshing}>
					<RefreshSpinner />
				</PullIndicator>
<SearchBox>
					<SearchIconWrap>
						<Icon name="search" size={18} />
					</SearchIconWrap>
					<SearchInput
						placeholder="Search downloaded models..."
						value={search}
						onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
							setSearch(e.target.value)
						}
						aria-label="Search downloaded models"
					/>
				</SearchBox>

				<StorageSection>
					<StorageHeader>
						<StorageLabel>
							{storage.models_count} model{storage.models_count !== 1 ? "s" : ""}
							{freeGB !== null ? ` · ${freeGB} GB free` : ""}
						</StorageLabel>
						<StorageValue>
							{usedGB} <span>GB</span>
						</StorageValue>
					</StorageHeader>
					{storageKnown && (
						<StorageBar>
							<StorageFill $pct={Math.min(usagePercent, 100)} />
						</StorageBar>
					)}
				</StorageSection>

				{/* Downloading Section */}
				{Object.values(downloads).filter(d => d.status !== "finished").length > 0 && (
					<DownloadSection>
						<SectionTitle>
							<Icon name="downloading" size={18} color={tokens.colors.tertiary} />
							Downloading
						</SectionTitle>
						{Object.values(downloads)
							.filter(d => d.status !== "finished")
							.map((dl) => {
								const progress = dl.totalBytes > 0
									? (dl.downloadedBytes / dl.totalBytes) * 100
									: 0;
								const modelInfo = catalog.find(m => m.id === dl.modelId);

								return (
									<DownloadCard key={dl.modelId}>
										<DownloadCardTop>
											<DownloadName>{dl.modelName}</DownloadName>
											<DownloadStatus $status={dl.status}>
												{dl.status === "downloading" ? "Downloading" :
													dl.status === "paused" ? "Paused" :
													dl.status === "failed" ? "Failed" : dl.status}
											</DownloadStatus>
										</DownloadCardTop>

										{dl.error && (
											<DownloadError>
												<Icon name="error" size={14} color={tokens.colors.error} />
												{dl.error}
											</DownloadError>
										)}

										<ProgressBarContainer>
											<ProgressBarFill $pct={progress} />
										</ProgressBarContainer>

										<DownloadMeta>
											<span>
												{formatBytes(dl.downloadedBytes)} / {dl.sizeLabel}
												{" · "}{Math.round(progress)}%
											</span>
											{dl.status === "downloading" && dl.speedBps > 0 && (
												<DownloadSpeed>{formatSpeed(dl.speedBps)}</DownloadSpeed>
											)}
										</DownloadMeta>

										<DownloadActions>
											{dl.status === "downloading" ? (
												<DownloadActionBtn onClick={() => pauseDownload(dl.modelId)}>
													<Icon name="pause" size={16} />
													Pause
												</DownloadActionBtn>
											) : dl.status === "paused" && modelInfo ? (
												<DownloadActionBtn $primary onClick={() => resumeDownload(modelInfo)}>
													<Icon name="play_arrow" size={16} />
													Resume
												</DownloadActionBtn>
											) : dl.status === "failed" && modelInfo ? (
												<DownloadActionBtn $primary onClick={() => resumeDownload(modelInfo)}>
													<Icon name="refresh" size={16} />
													Retry
												</DownloadActionBtn>
											) : null}
											<DownloadActionBtn onClick={() => cancelDownload(dl.modelId)}>
												<Icon name="close" size={16} />
												Cancel
											</DownloadActionBtn>
										</DownloadActions>
									</DownloadCard>
								);
							})}
					</DownloadSection>
				)}

				<ListHeader>
					<ListTitle>Installed</ListTitle>
					<AddButton onClick={() => navigate("/store")}>
						<Icon name="add" size={16} color={tokens.colors.primary} />
						Browse Store
					</AddButton>
				</ListHeader>

				{models.length === 0 ? (
					<EmptyState
						icon="deployed_code"
						message="No models downloaded yet"
					/>
				) : filtered.length === 0 ? (
					<EmptyState
						icon="deployed_code"
						message="No models match your search"
					/>
				) : (
					<Cards>
						{filtered.map((m, i) => {
							const isActive = activeModel === m.name;
							return (
								<Card
									key={m.id}
									$active={isActive}
									style={{ animationDelay: `${i * 50}ms` }}
								>
									<CardTop>
										<CardName>
											<ModelName>{m.name}</ModelName>
											{isActive && <ActiveBadge>Active</ActiveBadge>}
										</CardName>
									</CardTop>
									<CardMeta>
										<span>{m.size_label}</span>
										<span>{m.tag}</span>
									</CardMeta>
									<CardActions>
										<UseBtn
											$active={isActive}
											onClick={() => handleUse(m)}
											disabled={loadingModelId !== null}
										>
											{loadingModelId === m.id
												? "Loading..."
												: isActive
													? "Active"
													: "Use Model"}
										</UseBtn>
										<DeleteBtn onClick={() => handleDelete(m)} aria-label={`Delete ${m.name}`}>
											<Icon name="delete" size={18} color={tokens.colors.error} />
										</DeleteBtn>
									</CardActions>
								</Card>
							);
						})}
					</Cards>
				)}
			</Page>
		</AppLayout>
	);
}
