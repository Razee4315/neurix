import { AppLayout } from "@/components/layout/AppLayout";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { useAppContext } from "@/context/AppContext";
import { modelService, settingsService } from "@/services";
import type { DownloadedModel, StorageInfo } from "@/services/types";
import { tokens } from "@/theme/tokens";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
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
  ${({ $active }) => $active && `box-shadow: ${tokens.shadows.ambient};`}
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
  font-size: 10px;
  font-weight: ${tokens.typography.fontWeight.bold};
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.125rem 0.375rem;
  border-radius: ${tokens.borderRadius.sm};
  background: ${tokens.colors.primary}18;
  color: ${tokens.colors.primary};
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
  height: 36px;
  border-radius: ${tokens.borderRadius.md};
  border: none;
  font-size: ${tokens.typography.fontSize.sm};
  font-weight: ${tokens.typography.fontWeight.bold};
  text-transform: uppercase;
  letter-spacing: 0.05em;
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
  width: 36px;
  height: 36px;
  border-radius: ${tokens.borderRadius.md};
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
  0%, 100% { box-shadow: 0 0 0 0 rgba(143, 245, 255, 0.3); }
  50% { box-shadow: 0 0 20px 4px rgba(143, 245, 255, 0.15); }
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

export function MyModelsPage() {
	const navigate = useNavigate();
	const { activeModel, refreshActiveModel } = useAppContext();
	const { showConfirm, showAlert } = useConfirm();
	const { showToast } = useToast();
	const [search, setSearch] = useState("");
	const [models, setModels] = useState<DownloadedModel[]>([]);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const pullStartRef = useRef(0);
	const pageRef = useRef<HTMLDivElement>(null);
	const [storage, setStorage] = useState<StorageInfo>({ used_bytes: 0, models_count: 0 });

	const refresh = useCallback(async () => {
		const [downloaded, info] = await Promise.all([
			modelService.getDownloadedModels(),
			settingsService.getStorageInfo(),
		]);
		setModels(downloaded);
		setStorage(info);
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
			showToast(`${model.name} loaded`, "success");
			navigate("/chat", { state: { freshChat: true } });
		} catch (err) {
			showToast(`Failed to load ${model.name}`, "error");
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
		showToast(`${model.name} deleted`, "info");
	};

	const usedGB = formatStorageGB(storage.used_bytes);

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
					/>
				</SearchBox>

				<StorageSection>
					<StorageHeader>
						<StorageLabel>Storage used</StorageLabel>
						<StorageValue>
							{usedGB} <span>GB · {storage.models_count} model{storage.models_count !== 1 ? "s" : ""}</span>
						</StorageValue>
					</StorageHeader>
					<StorageBar>
						<StorageFill $pct={Math.min((storage.used_bytes / (10 * 1024 * 1024 * 1024)) * 100, 100)} />
					</StorageBar>
				</StorageSection>

				<ListHeader>
					<ListTitle>Downloaded</ListTitle>
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
										<DeleteBtn onClick={() => handleDelete(m)}>
											<Icon name="delete" size={16} color={tokens.colors.error} />
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
