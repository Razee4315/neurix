import { Icon } from "@/components/ui/Icon";
import { SetupArt } from "@/components/ui/Illustrations";
import { ModelMeters } from "@/components/ui/Meter";
import { NeurixLogo } from "@/components/ui/NeurixLogo";
import { useAppContext } from "@/context/AppContext";
import { modelService, settingsService } from "@/services";
import type { ModelInfo } from "@/services/types";
import { alpha } from "@/theme/alpha";
import { tokens } from "@/theme/tokens";
import { modelFit, nominalRamGb, recommendModel } from "@/utils/modelFit";
import { vibrate } from "@/utils/platform";
import { useModelDownload } from "@/utils/useModelDownload";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled, { keyframes } from "styled-components";

/* First run is one decision: which model to download. Neurix can make that
   decision from the device's memory, so this screen proposes a model, offers
   lightweight use-case presets, and gives a single primary Download CTA. */

type UseCase = "everyday" | "coding" | "companions";

interface UseCaseOption {
	id: UseCase;
	label: string;
	icon: string;
	hint: string;
}

const USE_CASES: UseCaseOption[] = [
	{
		id: "everyday",
		label: "Everyday",
		icon: "auto_awesome",
		hint: "Balanced for everyday writing, summaries, and offline questions",
	},
	{
		id: "coding",
		label: "Coding",
		icon: "code",
		hint: "Tuned for code generation, debugging, and step-by-step logic",
	},
	{
		id: "companions",
		label: "Companions",
		icon: "diversity_3",
		hint: "Natural conversational tone for custom characters and friends",
	},
];

function cleanSizeLabel(label: string): string {
	return label.trim().replace(/\s+/g, " ");
}

function pickForUseCase(
	catalog: ModelInfo[],
	deviceMemory: number | null,
	useCase: UseCase,
): ModelInfo | null {
	const base = recommendModel(catalog, deviceMemory);
	if (!base || useCase === "everyday") return base;

	const ram = nominalRamGb(deviceMemory) ?? 8;
	const fitting = catalog.filter(
		(m) => !m.legacy && m.tag !== "Added" && m.min_ram_gb <= ram,
	);
	if (fitting.length === 0) return base;

	if (useCase === "coding") {
		const coder =
			fitting.find((m) => m.id === "qwen-3.5-4b") ??
			fitting.find((m) => m.id === "lfm-2.5-2.6b") ??
			fitting.find((m) =>
				m.best_for.some((b) => /code|reasoning|maths|logic/i.test(b)),
			);
		return coder ?? base;
	}

	const companion =
		fitting.find((m) => m.id === "gemma-4-e2b") ??
		fitting.find((m) => m.id === "qwen-3.5-2b") ??
		fitting.find((m) =>
			m.best_for.some((b) => /natural writing|creative|everyday chat/i.test(b)),
		);
	return companion ?? base;
}

const rise = keyframes`
	from { opacity: 0; transform: translateY(10px); }
	to { opacity: 1; transform: translateY(0); }
`;

const Container = styled.div`
	height: 100vh;
	height: 100dvh;
	display: flex;
	flex-direction: column;
	background: ${tokens.surfaces.page};
	color: ${tokens.colors.onSurface};
	padding: max(1rem, env(safe-area-inset-top)) 1.5rem
		max(1.25rem, env(safe-area-inset-bottom));
	overflow-y: auto;
`;

const Header = styled.header`
	display: flex;
	align-items: center;
	justify-content: space-between;
	flex-shrink: 0;
	max-width: 28rem;
	width: 100%;
	margin: 0 auto;
`;

const LogoGroup = styled.div`
	display: flex;
	align-items: center;
	gap: 0.5rem;
`;

const BrandName = styled.span`
	font-family: ${tokens.typography.fontFamily.headline};
	font-weight: ${tokens.typography.fontWeight.bold};
	letter-spacing: 0.04em;
	color: ${tokens.colors.primary};
`;

const DeviceBadge = styled.span`
	display: inline-flex;
	align-items: center;
	gap: 0.35rem;
	padding: 0.25rem 0.625rem;
	border-radius: ${tokens.borderRadius.circle};
	background: ${tokens.colors.surfaceContainerLow};
	border: 1px solid ${tokens.colors.outlineVariant};
	font-family: ${tokens.typography.fontFamily.mono};
	font-size: 11px;
	color: ${tokens.colors.onSurfaceVariant};
`;

const Main = styled.main`
	flex: 1;
	display: flex;
	flex-direction: column;
	justify-content: center;
	width: 100%;
	max-width: 28rem;
	margin: 0 auto;
	padding: 1.25rem 0;
	animation: ${rise} 0.24s cubic-bezier(0.16, 1, 0.3, 1) both;
`;

const ArtRow = styled.div`
	display: flex;
	justify-content: flex-start;
	margin-bottom: 1rem;
`;

const Art = styled(SetupArt)`
	max-width: 20rem;
`;

const Eyebrow = styled.p`
	font-family: ${tokens.typography.fontFamily.mono};
	font-size: 11px;
	font-weight: ${tokens.typography.fontWeight.bold};
	letter-spacing: 0.14em;
	text-transform: uppercase;
	color: ${tokens.colors.primary};
`;

const Title = styled.h1`
	margin-top: 0.375rem;
	font-family: ${tokens.typography.fontFamily.headline};
	font-size: clamp(1.625rem, 6.5vw, 2.125rem);
	font-weight: ${tokens.typography.fontWeight.bold};
	line-height: 1.12;
`;

const Lead = styled.p`
	margin-top: 0.5rem;
	font-size: ${tokens.typography.fontSize.base};
	line-height: ${tokens.typography.lineHeight.relaxed};
	color: ${tokens.colors.onSurfaceVariant};
`;

const PresetBar = styled.div`
	display: flex;
	flex-wrap: wrap;
	gap: 0.375rem;
	margin-top: 1.125rem;
`;

const PresetChip = styled.button<{ $active: boolean }>`
	display: inline-flex;
	align-items: center;
	gap: 0.375rem;
	min-height: 34px;
	padding: 0 0.75rem;
	border-radius: ${tokens.borderRadius.md};
	border: 1px solid
		${({ $active }) =>
			$active ? tokens.colors.primary : tokens.colors.outlineVariant};
	background: ${({ $active }) =>
		$active
			? alpha(tokens.colors.primary, "1c")
			: tokens.colors.surfaceContainerLow};
	color: ${({ $active }) =>
		$active ? tokens.colors.primary : tokens.colors.onSurfaceVariant};
	font-size: ${tokens.typography.fontSize.xs};
	font-weight: ${tokens.typography.fontWeight.semibold};
	cursor: pointer;
	transition: all ${tokens.transitions.fast};

	&:hover {
		border-color: ${tokens.colors.primary};
		color: ${tokens.colors.onSurface};
	}
`;

const Card = styled.section`
	margin-top: 0.75rem;
	padding: 1rem 1.125rem;
	border-radius: ${tokens.borderRadius.xl};
	background: ${tokens.colors.surfaceContainerLow};
	border: 1px solid ${alpha(tokens.colors.primary, "45")};
	min-height: 9.5rem;
`;

const CardHead = styled.div`
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: 0.75rem;
`;

const ModelName = styled.h2`
	font-family: ${tokens.typography.fontFamily.headline};
	font-size: ${tokens.typography.fontSize.xl};
	font-weight: ${tokens.typography.fontWeight.bold};
`;

const ModelMetaRight = styled.div`
	display: inline-flex;
	align-items: center;
	gap: 0.5rem;
	flex-shrink: 0;
`;

const QuantPill = styled.span`
	font-family: ${tokens.typography.fontFamily.mono};
	font-size: 11px;
	padding: 0.15rem 0.45rem;
	border-radius: ${tokens.borderRadius.sm};
	background: ${tokens.colors.surfaceContainerHigh};
	color: ${tokens.colors.onSurfaceVariant};
`;

const ModelSize = styled.span`
	flex-shrink: 0;
	font-family: ${tokens.typography.fontFamily.mono};
	font-variant-numeric: tabular-nums;
	font-size: ${tokens.typography.fontSize.sm};
	font-weight: ${tokens.typography.fontWeight.semibold};
	color: ${tokens.colors.primary};
`;

const ModelText = styled.p`
	margin-top: 0.375rem;
	font-size: ${tokens.typography.fontSize.sm};
	line-height: 1.5;
	color: ${tokens.colors.onSurfaceVariant};
`;

const Meters = styled.div`
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	justify-content: space-between;
	gap: 0.375rem 1rem;
	margin-top: 0.625rem;
`;

const FitPill = styled.span`
	display: inline-flex;
	align-items: center;
	gap: 0.3rem;
	padding: 0.175rem 0.5rem;
	border-radius: ${tokens.borderRadius.sm};
	background: ${alpha(tokens.colors.secondary, "1a")};
	color: ${tokens.colors.secondary};
	font-size: 11px;
	font-weight: ${tokens.typography.fontWeight.semibold};
`;

const Reason = styled.div`
	display: flex;
	align-items: center;
	gap: 0.375rem;
	margin-top: 0.75rem;
	padding-top: 0.625rem;
	border-top: 1px solid ${tokens.colors.outlineVariant};
	font-size: ${tokens.typography.fontSize.xs};
	color: ${tokens.colors.secondary};
`;

const CardPlaceholder = styled.p`
	font-size: ${tokens.typography.fontSize.sm};
	color: ${tokens.colors.onSurfaceVariant};
`;

const Primary = styled.button`
	margin-top: 1rem;
	width: 100%;
	min-height: 50px;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 0.5rem;
	border: none;
	border-radius: ${tokens.borderRadius.lg};
	background: ${tokens.colors.primary};
	color: ${tokens.colors.onPrimaryFixed};
	font-family: ${tokens.typography.fontFamily.label};
	font-size: ${tokens.typography.fontSize.md};
	font-weight: ${tokens.typography.fontWeight.bold};
	cursor: pointer;
	transition:
		transform ${tokens.transitions.fast},
		filter ${tokens.transitions.fast};

	&:hover {
		filter: brightness(1.06);
	}
	&:active {
		transform: scale(0.98);
	}
	&:disabled {
		opacity: 0.5;
		cursor: default;
	}
	&:focus-visible {
		outline: 2px solid ${tokens.colors.onSurface};
		outline-offset: 2px;
	}
`;

const Secondary = styled.button`
	margin-top: 0.375rem;
	width: 100%;
	min-height: 42px;
	border: none;
	background: none;
	color: ${tokens.colors.onSurfaceVariant};
	font-size: ${tokens.typography.fontSize.base};
	font-weight: ${tokens.typography.fontWeight.semibold};
	cursor: pointer;

	&:hover {
		color: ${tokens.colors.onSurface};
	}
`;

const Facts = styled.ul`
	list-style: none;
	flex-shrink: 0;
	display: flex;
	flex-wrap: wrap;
	justify-content: center;
	gap: 0.375rem 1.25rem;
	font-size: ${tokens.typography.fontSize.xs};
	color: ${tokens.colors.onSurfaceVariant};

	li {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
	}
`;

type CatalogState =
	| { kind: "loading" }
	| { kind: "ready"; catalog: ModelInfo[]; deviceMemory: number | null }
	| { kind: "error" };

export function OnboardingScreen() {
	const navigate = useNavigate();
	const { updateSettings } = useAppContext();
	const download = useModelDownload();
	const [catalogState, setCatalogState] = useState<CatalogState>({
		kind: "loading",
	});
	const [useCase, setUseCase] = useState<UseCase>("everyday");
	const [starting, setStarting] = useState(false);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const [catalog, memory] = await Promise.all([
					modelService.getCatalog(),
					settingsService
						.getDeviceInfo()
						.then((info) => info.total_memory_bytes)
						.catch(() => null),
				]);
				if (cancelled) return;
				setCatalogState({ kind: "ready", catalog, deviceMemory: memory });
			} catch {
				if (!cancelled) setCatalogState({ kind: "error" });
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	const deviceMemory =
		catalogState.kind === "ready" ? catalogState.deviceMemory : null;
	const model = useMemo(
		() =>
			catalogState.kind === "ready"
				? pickForUseCase(catalogState.catalog, catalogState.deviceMemory, useCase)
				: null,
		[catalogState, useCase],
	);

	// Either way out ends first-run setup: it is not shown again.
	const done = () => updateSettings({ onboarding_done: true }).catch(() => {});

	const browse = () => {
		vibrate(5);
		done();
		navigate("/store");
	};

	const start = async () => {
		if (!model || starting) return;
		setStarting(true);
		try {
			if (await download(model, deviceMemory)) done();
		} finally {
			setStarting(false);
		}
	};

	const ramGb = nominalRamGb(deviceMemory);
	const activePreset =
		USE_CASES.find((u) => u.id === useCase) ?? USE_CASES[0];
	const sizeLabel = model ? cleanSizeLabel(model.size_label) : "";
	const fit = model ? modelFit(model, deviceMemory) : "unknown";

	return (
		<Container data-testid="onboarding-screen" data-tauri-drag-region>
			<Header>
				<LogoGroup>
					<NeurixLogo size={28} />
					<BrandName>NEURIX</BrandName>
				</LogoGroup>
				<DeviceBadge>
					<Icon name="memory" size={13} color={tokens.colors.primary} />
					{ramGb ? `${ramGb} GB RAM` : "Local Engine"}
				</DeviceBadge>
			</Header>

			<Main>
				<ArtRow>
					<Art />
				</ArtRow>
				<Eyebrow>One step to set up</Eyebrow>
				<Title>Pick the model that runs on this device</Title>
				<Lead>
					Neurix answers with an AI model stored on your device. Choose your
					focus below — after one download, everything runs offline.
				</Lead>

				<PresetBar role="group" aria-label="Choose a use case">
					{USE_CASES.map((option) => (
						<PresetChip
							key={option.id}
							type="button"
							$active={useCase === option.id}
							aria-pressed={useCase === option.id}
							onClick={() => setUseCase(option.id)}
						>
							<Icon name={option.icon} size={13} />
							{option.label}
						</PresetChip>
					))}
				</PresetBar>

				<Card aria-live="polite" aria-busy={catalogState.kind === "loading"}>
					{model ? (
						<>
							<CardHead>
								<ModelName>{model.name}</ModelName>
								<ModelMetaRight>
									<QuantPill>{model.quantization.split(" ")[0]}</QuantPill>
									<ModelSize>{sizeLabel}</ModelSize>
								</ModelMetaRight>
							</CardHead>
							<ModelText>{model.description}</ModelText>
							<Meters>
								<ModelMeters quality={model.quality} speed={model.speed} />
								<FitPill>
									<Icon name="check_circle" size={12} />
									{fit === "tight"
										? "Tight fit"
										: ramGb
											? `Fits ${ramGb} GB comfortably`
											: `Needs ${model.min_ram_gb} GB RAM`}
								</FitPill>
							</Meters>
							<Reason>
								<Icon name={activePreset.icon} size={13} />
								<span>
									{activePreset.hint}
									{ramGb ? ` · Matched to your ${ramGb} GB memory` : ""}
								</span>
							</Reason>
						</>
					) : catalogState.kind === "error" ? (
						<CardPlaceholder>
							The model list could not be loaded. You can still pick one from
							the store.
						</CardPlaceholder>
					) : (
						<CardPlaceholder>
							Checking what this device can run…
						</CardPlaceholder>
					)}
				</Card>

				<Primary type="button" onClick={start} disabled={!model || starting}>
					<Icon name="download" size={20} />
					{model ? `Download · ${sizeLabel}` : "Download"}
				</Primary>
				<Secondary type="button" onClick={browse}>
					Choose a different model
				</Secondary>
			</Main>

			<Facts>
				<li>
					<Icon
						name="verified_user"
						size={13}
						color={tokens.colors.secondary}
					/>
					Chats never leave this device
				</li>
				<li>
					<Icon name="cloud_off" size={13} color={tokens.colors.secondary} />
					Works offline
				</li>
				<li>
					<Icon name="favorite" size={13} color={tokens.colors.secondary} />
					Free, no account
				</li>
			</Facts>
		</Container>
	);
}
