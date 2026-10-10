import { AppLayout } from "@/components/layout/AppLayout";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { useToast } from "@/components/ui/Toast";
import { useAppContext } from "@/context/AppContext";
import { useDownloads } from "@/context/DownloadContext";
import { chatService, modelService, settingsService } from "@/services";
import type { BenchmarkResult, DownloadedModel, StorageInfo } from "@/services/types";
import { alpha } from "@/theme/alpha";
import { tokens } from "@/theme/tokens";
import { formatBytes, formatGB, formatSpeed } from "@/utils/format";
import { vibrate } from "@/utils/platform";
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
    box-shadow: 0 0 0 1px ${alpha(tokens.colors.primary, "20")}, ${tokens.shadows.ambient};
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
  background: ${alpha(tokens.colors.error, "12")};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background ${tokens.transitions.fast};

  &:hover { background: ${alpha(tokens.colors.error, "22")}; }
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
  border: 1px solid ${alpha(tokens.colors.tertiary, "30")};
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
			case "downloading": return alpha(tokens.colors.tertiary, "22");
			case "paused": return alpha(tokens.colors.outline, "22");
			case "failed": return alpha(tokens.colors.error, "22");
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
    background: ${alpha(tokens.colors.tertiary, "22")};
    color: ${tokens.colors.tertiary};
    &:hover { background: ${alpha(tokens.colors.tertiary, "33")}; }
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

const loadingSpin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
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

const SecondaryBtn = styled.button`
  padding: 0.5rem 0.875rem;
  border-radius: ${tokens.borderRadius.xl};
  border: 1px solid ${tokens.colors.outlineVariant};
  background: transparent;
  color: ${tokens.colors.onSurface};
  font-size: ${tokens.typography.fontSize.sm};
  font-weight: ${tokens.typography.fontWeight.semibold};
  cursor: pointer;

  &:disabled { opacity: 0.5; cursor: default; }
  &:not(:disabled):active { transform: scale(0.96); }
`;

const PrimaryCta = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.125rem;
  border-radius: ${tokens.borderRadius.xl};
  border: none;
  background: linear-gradient(135deg, ${tokens.colors.primary}, ${tokens.colors.primaryContainer});
  color: ${tokens.colors.onPrimaryFixed};
  font-size: ${tokens.typography.fontSize.sm};
  font-weight: ${tokens.typography.fontWeight.bold};
  cursor: pointer;

  &:active { transform: scale(0.96); }
`;

const STATUS_LABEL = {
	downloading: "Downloading",
	verifying: "Checking",
	paused: "Paused",
	failed: "Failed",
	finished: "Done",
} as const;

/* ── Component ── */

export function MyModelsPage() {
	const navigate = useNavigate();
	const { activeModelId, loadModel, unloadModel, refreshActiveModel } = useAppContext();
	const { downloads, installedVersion, pauseDownload, resumeDownload, cancelDownload } = useDownloads();
	const { showConfirm, showAlert } = useConfirm();
	const { showToast } = useToast();
	const [measuring, setMeasuring] = useState(false);
	const [speed, setSpeed] = useState<BenchmarkResult | null>(null);
	const [search, setSearch] = useState("");
	const [models, setModels] = useState<DownloadedModel[]>([]);
	const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
	const [isRefreshing, setIsRefreshing] = useState(false);
	const pullStartRef = useRef(0);
	const pageRef = useRef<HTMLDivElement>(null);
	const [storage, setStorage] = useState<StorageInfo>({ used_bytes: 0, models_count: 0, partial_bytes: 0 });
	const [availableSpace, setAvailableSpace] = useState<number | null>(null);
	const [loadingModel, setLoadingModel] = useState<DownloadedModel | null>(null);

	const refresh = useCallback(async () => {
		try {
			const [downloaded, info, available] = await Promise.all([
				modelService.getDownloadedModels(),
				settingsService.getStorageInfo(),
				settingsService.getAvailableSpace().catch(() => null),
			]);
			setModels(downloaded);
			setStorage(info);
			setAvailableSpace(available);
			setStatus("ready");
		} catch {
			setStatus("error");
		}
	}, []);

	// Refetch on mount and whenever a download finishes or is discarded.
	// biome-ignore lint/correctness/useExhaustiveDependencies: installedVersion is the refresh trigger
	useEffect(() => {
		refresh();
	}, [refresh, installedVersion]);

	const handlePullRefresh = async () => {
		vibrate(8);
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
		if (diff > 80 && el && el.scrollTop <= 0 && !isRefreshing) handlePullRefresh();
	};

	const filtered = models.filter(
		(m) => !search || m.name.toLowerCase().includes(search.toLowerCase()),
	);

	const handleUse = async (model: DownloadedModel) => {
		if (activeModelId === model.id) {
			navigate("/chat", { state: { freshChat: true } });
			return;
		}
		setLoadingModel(model);
		try {
			await loadModel(model.id);
			vibrate(15);
			navigate("/chat", { state: { freshChat: true } });
		} catch (err) {
			showAlert("Couldn't load the model", err instanceof Error ? err.message : String(err));
		} finally {
			setLoadingModel(null);
		}
	};

	const handleUnload = async () => {
		try {
			await unloadModel();
			showToast("Model unloaded. Its memory has been freed.", "info");
		} catch {
			showToast("Couldn't unload the model", "error");
		}
	};

	const handleDelete = async (model: DownloadedModel) => {
		const isActive = activeModelId === model.id;
		const ok = await showConfirm({
			title: isActive ? "Delete the model in use" : "Delete model",
			message: isActive
				? `"${model.name}" is the model you're chatting with. Deleting it unloads it and frees ${model.size_label}. Your chats are kept.`
				: `Delete "${model.name}"? This frees ${model.size_label}. You can download it again later.`,
			confirmLabel: "Delete",
			cancelLabel: "Cancel",
			danger: true,
		});
		if (!ok) return;
		vibrate(15);
		try {
			await modelService.deleteModel(model.id);
			showToast(`${model.name} deleted`, "info");
		} catch (err) {
			showAlert("Couldn't delete the model", err instanceof Error ? err.message : String(err));
		}
		await Promise.all([refresh(), refreshActiveModel()]);
	};

	const handleCancelDownload = async (modelId: string, name: string) => {
		const ok = await showConfirm({
			title: "Cancel download",
			message: `Stop downloading ${name} and delete what was downloaded so far?`,
			confirmLabel: "Cancel download",
			cancelLabel: "Keep it",
			danger: true,
		});
		if (ok) cancelDownload(modelId);
	};

	const handleSpeedTest = async () => {
		setMeasuring(true);
		setSpeed(null);
		try {
			setSpeed(await chatService.benchmarkModel());
		} catch (err) {
			showToast(typeof err === "string" ? err : "The speed test could not run", "error");
		} finally {
			setMeasuring(false);
		}
	};

	const pending = Object.values(downloads).filter((d) => d.status !== "finished");
	const storageKnown = availableSpace !== null;
	const totalSpace = storageKnown ? storage.used_bytes + availableSpace : 0;
	const usagePercent = storageKnown && totalSpace > 0 ? (storage.used_bytes / totalSpace) * 100 : 0;

	return (
		<AppLayout title="My Models">
			{loadingModel && (
				<LoadingOverlay title={`Loading ${loadingModel.name}`} subtitle="This can take a few seconds…" />
			)}
			<Page ref={pageRef} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
				<PullIndicator $visible={isRefreshing}>
					<RefreshSpinner />
				</PullIndicator>

				{models.length > 3 && (
					<SearchBox>
						<SearchIconWrap>
							<Icon name="search" size={18} />
						</SearchIconWrap>
						<SearchInput
							type="search"
							placeholder="Search downloaded models..."
							value={search}
							onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
							aria-label="Search downloaded models"
						/>
					</SearchBox>
				)}

				<StorageSection>
					<StorageHeader>
						<StorageLabel>
							{storage.models_count} model{storage.models_count !== 1 ? "s" : ""}
							{storageKnown ? ` · ${formatGB(availableSpace)} GB free` : ""}
							{storage.partial_bytes > 0
								? ` · ${formatBytes(storage.partial_bytes)} in unfinished downloads`
								: ""}
						</StorageLabel>
						<StorageValue>
							{formatGB(storage.used_bytes)} <span>GB</span>
						</StorageValue>
					</StorageHeader>
					{storageKnown && (
						<StorageBar>
							<StorageFill $pct={Math.min(usagePercent, 100)} />
						</StorageBar>
					)}
				</StorageSection>

				{pending.length > 0 && (
					<DownloadSection>
						<SectionTitle>
							<Icon name="downloading" size={18} color={tokens.colors.tertiary} />
							Downloads
						</SectionTitle>
						{pending.map((dl) => {
							const progress = dl.totalBytes > 0 ? (dl.downloadedBytes / dl.totalBytes) * 100 : 0;
							return (
								<DownloadCard key={dl.modelId}>
									<DownloadCardTop>
										<DownloadName>{dl.modelName}</DownloadName>
										<DownloadStatus $status={dl.status}>{STATUS_LABEL[dl.status]}</DownloadStatus>
									</DownloadCardTop>

									{dl.error && (
										<DownloadError role="alert">
											<Icon name="error" size={14} color={tokens.colors.error} />
											{dl.error}
										</DownloadError>
									)}

									<ProgressBarContainer
										role="progressbar"
										aria-label={`${dl.modelName} download`}
										aria-valuemin={0}
										aria-valuemax={100}
										aria-valuenow={Math.round(progress)}
									>
										<ProgressBarFill $pct={progress} />
									</ProgressBarContainer>

									<DownloadMeta>
										<span>
											{formatBytes(dl.downloadedBytes)} / {dl.sizeLabel} · {Math.round(progress)}%
										</span>
										{dl.status === "downloading" && dl.speedBps > 0 && (
											<DownloadSpeed>{formatSpeed(dl.speedBps)}</DownloadSpeed>
										)}
									</DownloadMeta>

									<DownloadActions>
										{dl.status === "downloading" && (
											<DownloadActionBtn type="button" onClick={() => pauseDownload(dl.modelId)}>
												<Icon name="pause" size={16} />
												Pause
											</DownloadActionBtn>
										)}
										{(dl.status === "paused" || dl.status === "failed") && !dl.blockedByWifi && (
											<DownloadActionBtn type="button" $primary onClick={() => resumeDownload(dl.model)}>
												<Icon name={dl.status === "failed" ? "refresh" : "play_arrow"} size={16} />
												{dl.status === "failed" ? "Retry" : "Resume"}
											</DownloadActionBtn>
										)}
										{dl.blockedByWifi && (
											<DownloadActionBtn
												type="button"
												$primary
												onClick={() => resumeDownload(dl.model, { allowMobileData: true })}
											>
												<Icon name="download" size={16} />
												Use this connection
											</DownloadActionBtn>
										)}
										{dl.status !== "verifying" && (
											<DownloadActionBtn
												type="button"
												onClick={() => handleCancelDownload(dl.modelId, dl.modelName)}
											>
												<Icon name="close" size={16} />
												Cancel
											</DownloadActionBtn>
										)}
									</DownloadActions>
								</DownloadCard>
							);
						})}
					</DownloadSection>
				)}

				<ListHeader>
					<ListTitle>Installed</ListTitle>
					<AddButton type="button" onClick={() => navigate("/store")}>
						<Icon name="add" size={16} color={tokens.colors.primary} />
						Browse Store
					</AddButton>
				</ListHeader>

				{status === "loading" ? (
					<EmptyState icon="deployed_code" message="Loading your models…" />
				) : status === "error" ? (
					<EmptyState
						icon="error_outline"
						message="Couldn't read your models"
						subtitle="Something went wrong while checking storage."
					>
						<PrimaryCta type="button" onClick={refresh}>
							<Icon name="refresh" size={16} />
							Try again
						</PrimaryCta>
					</EmptyState>
				) : models.length === 0 ? (
					<EmptyState
						art="models"
						message="No models yet"
						subtitle="Download one over WiFi and it's yours to use offline, forever."
					>
						<PrimaryCta type="button" onClick={() => navigate("/store")}>
							<Icon name="download" size={16} />
							Browse models
						</PrimaryCta>
					</EmptyState>
				) : filtered.length === 0 ? (
					<EmptyState art="search" message="No models match your search" />
				) : (
					<Cards>
						{filtered.map((m, i) => {
							const isActive = activeModelId === m.id;
							return (
								<Card key={m.id} $active={isActive} style={{ animationDelay: `${i * 50}ms` }}>
									<CardTop>
										<CardName>
											<ModelName>{m.name}</ModelName>
											{isActive && <ActiveBadge>In use</ActiveBadge>}
										</CardName>
									</CardTop>
									<CardMeta>
										<span>{m.size_label}</span>
										<span>{m.tag === "Legacy" ? "Earlier model · newer ones answer better" : m.tag}</span>
									</CardMeta>
									{isActive && speed && (
										<CardMeta role="status">
											<span>
												{speed.tokens_per_second.toFixed(1)} tokens/s writing ·{" "}
												{speed.prompt_tokens_per_second.toFixed(0)} reading · {speed.threads} threads
											</span>
										</CardMeta>
									)}
									<CardActions>
										<UseBtn
											type="button"
											$active={isActive}
											onClick={() => handleUse(m)}
											disabled={loadingModel !== null}
										>
											{isActive ? "New chat" : "Use model"}
										</UseBtn>
										{isActive && (
											<SecondaryBtn type="button" onClick={handleSpeedTest} disabled={measuring}>
												{measuring ? "Measuring…" : "Speed test"}
											</SecondaryBtn>
										)}
										{isActive && (
											<SecondaryBtn type="button" onClick={handleUnload} disabled={measuring}>
												Unload
											</SecondaryBtn>
										)}
										<DeleteBtn type="button" onClick={() => handleDelete(m)} aria-label={`Delete ${m.name}`}>
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
