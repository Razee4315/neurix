import { CharacterPicker } from "@/components/character/CharacterPicker";
import { AppLayout } from "@/components/layout/AppLayout";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Icon } from "@/components/ui/Icon";
import { ThemePicker } from "@/components/ui/ThemePicker";
import { useToast } from "@/components/ui/Toast";
import { useAppContext } from "@/context/AppContext";
import { useCharacters } from "@/context/CharacterContext";
import { parseCloudImport } from "@/utils/cloudImport";
import { accentOf } from "@/utils/characterAccent";
import { clearChatAssignments } from "@/utils/chatMeta";
import type { BenchmarkResult, KvCacheQuant, Settings } from "@/services/types";
import { chatService, dataService, historyService, settingsService } from "@/services";
import { alpha } from "@/theme/alpha";
import { FONT_SCALES, type FontSize, isFontSize } from "@/theme/themes";
import { isMac, isMobile, vibrate } from "@/utils/platform";
import { type Prefs, setPref, usePrefs } from "@/utils/prefs";
import { tokens } from "@/theme/tokens";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";

/* ── Styles ── */

const Page = styled.div`
  max-width: 44rem;
  margin: 0 auto;
  padding: 1.25rem;
`;

/* ── Toggle Rows ── */

const Section = styled.div`
  background: ${tokens.colors.surfaceContainerLow};
  border: 1px solid ${tokens.colors.outlineVariant};
  border-radius: ${tokens.borderRadius.lg};
  margin-bottom: 1rem;
  overflow: hidden;
`;

const ToggleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1rem;
  gap: 0.75rem;
  transition: background ${tokens.transitions.fast};
  border-radius: ${tokens.borderRadius.md};

  &:hover { background: ${tokens.colors.surfaceContainerHigh}; }
`;

const RowLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
  min-width: 0;
`;

const RowIcon = styled.div`
  width: 36px;
  height: 36px;
  border-radius: ${tokens.borderRadius.md};
  background: ${tokens.colors.surfaceContainerHighest};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

const RowText = styled.div`
  min-width: 0;
`;

const RowTitle = styled.div`
  font-size: ${tokens.typography.fontSize.base};
  font-weight: ${tokens.typography.fontWeight.medium};
  color: ${tokens.colors.onSurface};
`;

/* The line under a setting explains it, so it wraps rather than being cut
   off on a narrow phone. */
const RowSub = styled.div`
  font-size: ${tokens.typography.fontSize.sm};
  line-height: 1.4;
  color: ${tokens.colors.onSurfaceVariant};
  overflow-wrap: anywhere;
`;

/* ── Toggle Switch ── */

const Toggle = styled.button<{ $on: boolean }>`
  /* A fingertip needs more than the switch's 22px. */
  &::before {
    content: "";
    position: absolute;
    inset: -11px -4px;
  }

  width: 40px;
  height: 22px;
  border-radius: 11px;
  border: none;
  cursor: pointer;
  position: relative;
  flex-shrink: 0;
  transition: background ${tokens.transitions.fast};
  background: ${({ $on }) =>
		$on ? tokens.colors.primary : tokens.colors.surfaceContainerHighest};

  &::after {
    content: "";
    position: absolute;
    top: 3px;
    left: ${({ $on }) => ($on ? "21px" : "3px")};
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: ${({ $on }) =>
			$on ? tokens.colors.onPrimaryContainer : tokens.colors.outline};
    transition: left ${tokens.transitions.fast};
  }
`;

/* ── Version ── */

/* Rows that act as a button reuse the row layout on a real <button>, so they
   are reachable and operable from the keyboard. */
const ActionRow = styled(ToggleRow)`
  width: 100%;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;

  &:hover { background: ${tokens.colors.surfaceContainerHigh}; }
  &:disabled { opacity: 0.6; cursor: default; }
`;

const SectionHeading = styled.h2`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: ${tokens.typography.fontFamily.headline};
  font-size: ${tokens.typography.fontSize.base};
  font-weight: ${tokens.typography.fontWeight.bold};
  color: ${tokens.colors.onSurface};
  margin: 1.5rem 0.25rem 0.5rem;

  &:first-child { margin-top: 0; }
`;

const AppearancePanel = styled(Section)`
  padding: 0.875rem;
`;

const SizeLabel = styled.h3`
  margin-top: 1rem;
  font-size: ${tokens.typography.fontSize.sm};
`;

const Segments = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.25rem;
  padding: 0.25rem;
  margin-top: 0.75rem;
  border-radius: ${tokens.borderRadius.xl};
  background: ${tokens.colors.surfaceContainerHigh};
`;

const Segment = styled.button<{ $active: boolean; $scale: number }>`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  column-gap: 0.375rem;
  min-height: 44px;
  padding: 0.375rem 0.25rem;
  border: none;
  border-radius: ${tokens.borderRadius.lg};
  background: ${({ $active }) => ($active ? tokens.colors.primary : "transparent")};
  color: ${({ $active }) => ($active ? tokens.colors.onPrimaryFixed : tokens.colors.onSurfaceVariant)};
  font-family: ${tokens.typography.fontFamily.headline};
  font-weight: ${tokens.typography.fontWeight.bold};
  font-size: ${tokens.typography.fontSize.xs};

  > span:first-child { font-size: ${({ $scale }) => 16 * $scale}px; }
  cursor: pointer;
  transition: background ${tokens.transitions.fast};
`;

const EngineRow = styled(ToggleRow)`
  flex-wrap: wrap;
  > :last-child { margin-left: auto; }
`;

const EngineControl = styled.select`
  max-width: 100%;
  min-height: 42px;
  padding: 0.375rem 0.625rem;
  background: ${tokens.colors.surfaceContainerHigh};
  color: ${tokens.colors.onSurface};
  border: 1px solid ${tokens.colors.outlineVariant};
  border-radius: ${tokens.borderRadius.md};
  font: inherit;

  &:focus-visible { outline: 2px solid ${tokens.colors.primary}; }
  &:disabled { opacity: 0.6; }
`;

const LayerInput = styled(EngineControl)`
  width: 5rem;
`;

const PrivacyPanel = styled(Section)`
  > :first-child {
    background: ${alpha(tokens.colors.primary, "12")};
    border-bottom: 1px solid ${tokens.colors.outlineVariant};
  }
`;

const Result = styled.div`
  margin: 0 1rem 0.875rem;
  padding: 0.75rem 0.875rem;
  border-radius: ${tokens.borderRadius.lg};
  background: ${alpha(tokens.colors.secondary, "14")};
  border: 1px solid ${alpha(tokens.colors.secondary, "40")};
  font-size: ${tokens.typography.fontSize.sm};
  line-height: ${tokens.typography.lineHeight.relaxed};
  color: ${tokens.colors.onSurface};

  strong {
    font-family: ${tokens.typography.fontFamily.mono};
    color: ${tokens.colors.secondary};
  }
`;

const CONTEXT_CHOICES = [0, 2048, 4096, 8192, 16384, 32768];
const THREAD_CHOICES = Array.from({ length: 17 }, (_, i) => i);

/** A plain-language read of a writing speed, in tokens per second. */
function speedVerdict(tokensPerSecond: number): string {
	if (tokensPerSecond >= 20) return "Fast: answers appear quicker than you can read them.";
	if (tokensPerSecond >= 8) return "Comfortable: about reading speed.";
	if (tokensPerSecond >= 3) return "Slow but usable. A smaller model will feel much quicker.";
	return "Very slow on this device. Try a smaller model.";
}

const ErrorCard = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem;
  border-radius: ${tokens.borderRadius.xl};
  background: ${tokens.colors.surfaceContainerHigh};
  border: 1px solid ${tokens.colors.error};
  color: ${tokens.colors.onSurface};
  font-size: ${tokens.typography.fontSize.sm};
`;

const FONT_LABELS: Record<FontSize, string> = {
	small: "Small text",
	medium: "Default text",
	large: "Large text",
	xlarge: "Extra large text",
};

const FONT_NAMES: Record<FontSize, string> = {
	small: "Small",
	medium: "Default",
	large: "Large",
	xlarge: "XL",
};

type ToggleKey = "wifi_only" | "save_history" | "show_speed" | "air_gap" | "flash_attention" | "strip_thinking_history";

/* ── Component ── */

export function SettingsPage() {
	const prefs = usePrefs();
	const phone = isMobile();
	const mod = isMac() ? "⌘" : "Ctrl";
	const navigate = useNavigate();
	const {
		settings,
		settingsFailed,
		refreshSettings,
		updateSettings,
		activeModel,
		activeModelId,
		activeModelInfo,
		loadingModelId,
		loadModel,
		unloadModel,
	} = useAppContext();
	const { activeCharacter } = useCharacters();
	const { showConfirm } = useConfirm();
	const { showToast } = useToast();
	const [pickerOpen, setPickerOpen] = useState(false);
	const [busy, setBusy] = useState<"export" | "import" | "cloud" | null>(null);
	const cloudInput = useRef<HTMLInputElement>(null);
	const [gpuDraft, setGpuDraft] = useState<string | null>(null);
	const [autoThreads, setAutoThreads] = useState<number | null>(null);
	const [reloadingHere, setReloading] = useState(false);
	// The engine reload is unload + load; any load elsewhere counts too.
	const reloading = reloadingHere || loadingModelId !== null;
	const [testing, setTesting] = useState(false);
	const [benchmark, setBenchmark] = useState<BenchmarkResult | null>(null);

	useEffect(() => {
		settingsService
			.getDeviceInfo()
			.then((info) => setAutoThreads(info.inference_threads))
			.catch(() => {});
	}, []);
	// Optimistic values shown while a write is in flight. Cleared when the
	// write settles, so a failed save snaps back to the stored value.
	const [pending, setPending] = useState<Partial<Settings>>({});

	const current = <K extends keyof Settings>(key: K): Settings[K] | undefined =>
		key in pending ? (pending[key] as Settings[K]) : settings?.[key];

	const save = async (patch: Partial<Settings>) => {
		setPending((p) => ({ ...p, ...patch }));
		try {
			await updateSettings(patch);
			return true;
		} catch {
			showToast("Couldn't save that setting.", "error");
			return false;
		} finally {
			setPending((p) => {
				const next = { ...p };
				for (const key of Object.keys(patch)) delete next[key as keyof Settings];
				return next;
			});
		}
	};

	const saveEngineSetting = async (patch: Partial<Settings>) => {
		if (testing || reloading) return;
		vibrate(5);
		setReloading(true);
		try {
			if (!(await save(patch))) return;
			setBenchmark(null);
			if (!activeModelId) return;
			await unloadModel();
			await loadModel(activeModelId);
			showToast(`${activeModel ?? "Model"} reloaded with the new setting`, "success");
		} catch (err) {
			showToast(
				typeof err === "string" ? err : err instanceof Error ? err.message : "Couldn't reload the model with that setting",
				"error",
			);
		} finally {
			setReloading(false);
		}
	};

	const handleSpeedTest = async () => {
		setTesting(true);
		setBenchmark(null);
		try {
			setBenchmark(await chatService.benchmarkModel());
		} catch (err) {
			showToast(typeof err === "string" ? err : "The speed test could not run", "error");
		} finally {
			setTesting(false);
		}
	};

	const handleClearHistory = async () => {
		const ok = await showConfirm({
			title: "Clear history",
			message: "Delete all chat history? This cannot be undone.",
			confirmLabel: "Delete all",
			cancelLabel: "Cancel",
			danger: true,
		});
		if (!ok) return;
		vibrate(15);
		try {
			await historyService.clearAllConversations();
			showToast("Chat history cleared", "info");
		} catch {
			showToast("Couldn't clear chat history", "error");
			return;
		}
		try {
			clearChatAssignments(window.localStorage);
		} catch {
			showToast("Couldn't clear the saved pins and folder assignments.", "error");
		}
	};

	const handleResetDefaults = async () => {
		const ok = await showConfirm({
			title: "Reset settings",
			message:
				"Restore every setting, including the theme, to its default? Your chats, models and custom characters are kept.",
			confirmLabel: "Reset",
			cancelLabel: "Cancel",
		});
		if (!ok) return;
		try {
			await settingsService.resetSettings();
			await refreshSettings();
			showToast("Settings reset to defaults", "success");
		} catch {
			showToast("Couldn't reset settings", "error");
		}
	};

	const handleExport = async () => {
		setBusy("export");
		try {
			if (await dataService.exportToFile()) showToast("Backup saved", "success");
		} catch (err) {
			showToast(err instanceof Error ? err.message : "Couldn't save the backup", "error");
		} finally {
			setBusy(null);
		}
	};

	const handleImport = async () => {
		setBusy("import");
		try {
			const before = (await historyService.getConversations()).length;
			const summary = await dataService.importFromFile();
			if (summary) {
				await refreshSettings();
				const added = (await historyService.getConversations()).length - before;
				showToast(
					added > 0
						? `Added ${added} new chat${added === 1 ? "" : "s"} from the backup`
						: "Nothing new: this backup's chats are already here",
					"success",
				);
			}
		} catch (err) {
			showToast(typeof err === "string" ? err : err instanceof Error ? err.message : "Couldn't import that file", "error");
		} finally {
			setBusy(null);
		}
	};

	const handleCloudImport = async (file: File) => {
		if (busy) return;
		setBusy("cloud");
		try {
			const conversations = parseCloudImport(await file.text());
			const existing = new Set((await historyService.getConversations()).map((chat) => chat.id.toLowerCase()));
			let imported = 0;
			let skipped = 0;
			let failed = 0;
			for (const chat of conversations) {
				const id = chat.id.toLowerCase();
				if (existing.has(id)) {
					skipped += 1;
					continue;
				}
				try {
					await historyService.saveConversation(chat);
					existing.add(id);
					imported += 1;
				} catch {
					failed += 1;
				}
			}
			const summary = [`${imported} imported`, ...(skipped ? [`${skipped} already saved`] : []),
				...(failed ? [`${failed} couldn't be saved`] : [])].join(", ");
			showToast(summary, failed ? "error" : "success");
		} catch (err) {
			showToast(err instanceof Error ? err.message : "Couldn't import those conversations.", "error");
		} finally {
			setBusy(null);
		}
	};

	if (!settings) {
		return (
			<AppLayout title="Settings">
				<Page>
					{settingsFailed ? (
						<ErrorCard role="alert">
							<span>Settings couldn't be loaded, so nothing can be changed right now.</span>
							<ActionRow as="button" type="button" onClick={() => refreshSettings()} style={{ width: "auto" }}>
								<RowLeft>
									<Icon name="refresh" size={18} color={tokens.colors.primary} />
									<RowTitle>Try again</RowTitle>
								</RowLeft>
							</ActionRow>
						</ErrorCard>
					) : (
						<SectionHeading aria-busy="true">Loading settings…</SectionHeading>
					)}
				</Page>
			</AppLayout>
		);
	}

	const fontSize = isFontSize(current("font_size")) ? (current("font_size") as FontSize) : "medium";

	const engineBusy = reloading || testing;
	const contextSize = current("context_size") ?? 0;
	const gpuLayers = current("gpu_layers") ?? 0;
	const toggleRow = (key: ToggleKey, icon: string, title: string, sub: string, defaultOn = false) => {
		const enabled = current(key) ?? defaultOn;
		const affectsLoadedModel = key === "flash_attention";
		return (
			<ToggleRow>
				<RowLeft>
					<RowIcon>
						<Icon name={icon} size={18} color={tokens.colors.primary} />
					</RowIcon>
					<RowText>
						<RowTitle>{title}</RowTitle>
						<RowSub id={`setting-${key}-help`}>{sub}</RowSub>
					</RowText>
				</RowLeft>
				<Toggle
					type="button"
					$on={enabled}
					disabled={key in pending || (affectsLoadedModel && engineBusy)}
					onClick={() => {
						if (affectsLoadedModel) {
							void saveEngineSetting({ [key]: !enabled });
						} else {
							vibrate(5);
							void save({ [key]: !enabled });
						}
					}}
					role="switch"
					aria-checked={enabled}
					aria-describedby={`setting-${key}-help`}
					aria-label={title}
				/>
			</ToggleRow>
		);
	};

	type BoolPref = { [K in keyof Prefs]: Prefs[K] extends boolean ? K : never }[keyof Prefs];
	const prefRow = (key: BoolPref, icon: string, title: string, sub: string) => (
		<ToggleRow>
			<RowLeft>
				<RowIcon>
					<Icon name={icon} size={18} color={tokens.colors.primary} />
				</RowIcon>
				<RowText>
					<RowTitle>{title}</RowTitle>
					<RowSub>{sub}</RowSub>
				</RowText>
			</RowLeft>
			<Toggle
				type="button"
				$on={prefs[key]}
				onClick={() => setPref(key, !prefs[key])}
				role="switch"
				aria-checked={prefs[key]}
				aria-label={title}
			/>
		</ToggleRow>
	);

	const infoRow = (icon: string, title: string, sub: string) => (
		<ToggleRow>
			<RowLeft>
				<RowIcon>
					<Icon name={icon} size={18} color={tokens.colors.primary} />
				</RowIcon>
				<RowText>
					<RowTitle>{title}</RowTitle>
					<RowSub>{sub}</RowSub>
				</RowText>
			</RowLeft>
		</ToggleRow>
	);

	const actionRow = (
		icon: string,
		title: string,
		sub: string,
		onClick: () => void,
		opts: { danger?: boolean; disabled?: boolean; chevron?: boolean } = {},
	) => (
		<ActionRow as="button" type="button" onClick={onClick} disabled={opts.disabled}>
			<RowLeft>
				<RowIcon>
					<Icon name={icon} size={18} color={opts.danger ? tokens.colors.error : tokens.colors.primary} />
				</RowIcon>
				<RowText>
					<RowTitle style={opts.danger ? { color: tokens.colors.error } : undefined}>{title}</RowTitle>
					<RowSub>{sub}</RowSub>
				</RowText>
			</RowLeft>
			{opts.chevron && <Icon name="chevron_right" size={20} color={tokens.colors.onSurfaceVariant} />}
		</ActionRow>
	);

	return (
		<AppLayout title="Settings">
			<Page>
				<SectionHeading><Icon name="palette" size={18} color={tokens.colors.primary} />Appearance</SectionHeading>
				<AppearancePanel>
					<ThemePicker value={current("theme") ?? "karakoram"} onChange={(theme) => save({ theme })} />
					<SizeLabel>Text size</SizeLabel>
					<Segments role="radiogroup" aria-label="Text size">
						{(Object.keys(FONT_SCALES) as FontSize[]).map((size) => (
							<Segment
								key={size}
								type="button"
								role="radio"
								aria-checked={fontSize === size}
								aria-label={FONT_LABELS[size]}
								$active={fontSize === size}
								$scale={FONT_SCALES[size]}
								onClick={() => save({ font_size: size })}
							>
								<span aria-hidden="true">Aa</span>
								<span>{FONT_NAMES[size]}</span>
							</Segment>
						))}
					</Segments>
				</AppearancePanel>

				<SectionHeading>
					<Icon name="memory" size={18} color={tokens.colors.primary} />
					Inference Engine &amp; Memory
				</SectionHeading>
				<Section>
					<EngineRow>
						<RowText>
							<RowTitle as="label" htmlFor="context-window">Context Window</RowTitle>
							<RowSub id="context-window-help">
								Larger windows use more RAM.
								{activeModelInfo ? ` Current model uses ${activeModelInfo.context_length.toLocaleString()} tokens.` : ""}
							</RowSub>
						</RowText>
						<EngineControl
							id="context-window"
							aria-describedby="context-window-help"
							value={contextSize}
							disabled={engineBusy}
							onChange={(event) => void saveEngineSetting({ context_size: Number(event.target.value) })}
						>
							{!CONTEXT_CHOICES.includes(contextSize) && <option value={contextSize}>{contextSize.toLocaleString()} tokens</option>}
							{CONTEXT_CHOICES.map((value) => (
								<option key={value} value={value}>{value ? `${value.toLocaleString()} tokens` : "Auto"}</option>
							))}
						</EngineControl>
					</EngineRow>
					<EngineRow>
						<RowText>
							<RowTitle as="label" htmlFor="kv-cache">KV Cache Quantization</RowTitle>
							<RowSub id="kv-cache-help">Choose how much memory the conversation cache uses.</RowSub>
						</RowText>
						<EngineControl
							id="kv-cache"
							aria-describedby="kv-cache-help"
							value={current("kv_cache_quant") ?? "q8_0"}
							disabled={engineBusy}
							onChange={(event) => void saveEngineSetting({ kv_cache_quant: event.target.value as KvCacheQuant })}
						>
							<option value="q8_0">Q8_0 Balanced (−47% RAM)</option>
							<option value="f16">F16 Full Precision</option>
							<option value="q4_0">Q4_0 Ultra-Compact</option>
						</EngineControl>
					</EngineRow>
					{toggleRow("flash_attention", "bolt", "Flash Attention", "Speeds up attention and reduces memory use where supported.", true)}
					<EngineRow>
						<RowText>
							<RowTitle as="label" htmlFor="gpu-layers">GPU Offload Layers</RowTitle>
							<RowSub id="gpu-layers-help">
								0 runs on the CPU. Neurix retries on the CPU if GPU loading fails. Applies when you leave the field.
							</RowSub>
						</RowText>
						<LayerInput
							as="input"
							id="gpu-layers"
							aria-describedby="gpu-layers-help"
							type="number"
							min={0}
							max={99}
							step={1}
							value={gpuDraft ?? gpuLayers}
							disabled={engineBusy}
							onChange={(event) => setGpuDraft(event.currentTarget.value)}
							onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
							onBlur={() => {
								setGpuDraft(null);
								if (!gpuDraft) return;
								const value = Math.min(99, Math.max(0, Math.round(Number(gpuDraft))));
								if (value !== gpuLayers) void saveEngineSetting({ gpu_layers: value });
							}}
						/>
					</EngineRow>
					<EngineRow>
						<RowText>
							<RowTitle as="label" htmlFor="inference-threads">Inference Threads</RowTitle>
							<RowSub id="inference-threads-help">
								{autoThreads ? `Auto uses ${autoThreads} fast cores on this device.` : "Auto uses this device's fast cores."}
							</RowSub>
						</RowText>
						<EngineControl
							id="inference-threads"
							aria-describedby="inference-threads-help"
							value={current("threads") ?? 0}
							disabled={engineBusy}
							onChange={(event) => void saveEngineSetting({ threads: Number(event.target.value) })}
						>
							{THREAD_CHOICES.map((value) => <option key={value} value={value}>{value || "Auto"}</option>)}
						</EngineControl>
					</EngineRow>
					{toggleRow(
						"strip_thinking_history",
						"psychology",
						"Strip <think> scratchpad from prompt history",
						"Keep reasoning visible in chat while leaving it out of future prompts.",
						true,
					)}

					{actionRow(
						"speed",
						testing ? "Measuring…" : reloading ? "Reloading model…" : "Run a speed test",
						activeModel
							? `Measures ${activeModel} on this device (about 15 seconds)`
							: "Load a model first, then measure it here",
						handleSpeedTest,
						{ disabled: !activeModelId || testing || reloading },
					)}
					{benchmark && (
						<Result role="status">
							<strong>{benchmark.tokens_per_second.toFixed(1)}</strong> tokens per second writing ·{" "}
							<strong>{benchmark.prompt_tokens_per_second.toFixed(0)}</strong> reading ·{" "}
							{benchmark.threads} threads
							<br />
							{speedVerdict(benchmark.tokens_per_second)}
						</Result>
					)}
				</Section>

				<SectionHeading>
					<Icon name="shield" size={18} color={tokens.colors.primary} />
					Privacy &amp; Air-Gap Lock
				</SectionHeading>
				<PrivacyPanel>
					{toggleRow(
						"air_gap",
						"cloud_off",
						"Air-Gap Mode",
						"Blocks Hugging Face model downloads and Hub inspection, Gmail IMAP, and GitHub fetches at the Rust backend boundary.",
					)}
					{infoRow("cloud_off", "Runs on this device", "Models answer locally. Prompts and replies never leave it")}
					{infoRow("verified_user", "Telemetry", "No analytics, tracking, or account")}
				</PrivacyPanel>

				<SectionHeading>Chat &amp; Companions</SectionHeading>
				<Section>
					<ActionRow as="button" type="button" onClick={() => setPickerOpen(true)}>
						<RowLeft>
							<RowIcon>
								<Icon
									name={activeCharacter?.icon ?? "smart_toy"}
									size={18}
									color={accentOf(activeCharacter)}
								/>
							</RowIcon>
							<RowText>
								<RowTitle>Default character</RowTitle>
								<RowSub>
									{activeCharacter
										? `${activeCharacter.name}: ${activeCharacter.description || "Custom"}`
										: "Choose a personality"}
								</RowSub>
							</RowText>
						</RowLeft>
						<Icon name="chevron_right" size={20} color={tokens.colors.onSurfaceVariant} />
					</ActionRow>
					{toggleRow("save_history", "history", "Save chat history", "Keep conversations on this device")}
					{toggleRow("show_speed", "speed", "Show token speed", "Display generation speed under replies")}
					{/* Touch keyboards always add a line on Enter, so this is desktop only. */}
					{!phone &&
						prefRow(
							"enterSends",
							"keyboard_return",
							"Send with Enter",
							prefs.enterSends ? "Shift+Enter adds a new line" : "Cmd/Ctrl+Enter sends, Enter adds a line",
						)}
					{prefRow("showStarters", "emoji_objects", "Suggested prompts", "Show prompt ideas on a new chat")}
					{prefRow("autoCopy", "content_copy", "Copy replies automatically", "Put each finished reply on the clipboard")}
					{prefRow("friendsLearn", "diversity_3", "Friends learn from chats", "They keep facts you tell them, on this device")}
					{prefRow("notifyReplies", "notifications", "Tell me when a reply is ready", "A notification if Neurix is in the background. It never shows the reply")}
					{prefRow(
						"showPrivacyNote",
						"enhanced_encryption",
						"Privacy reminder",
						"Show the on-device note under the message box",
					)}
					{/* A phone screen is narrower than either width. */}
					{!phone && (
					<ToggleRow>
						<RowLeft>
							<RowIcon>
								<Icon name="format_size" size={18} color={tokens.colors.primary} />
							</RowIcon>
							<RowText>
								<RowTitle>Chat width</RowTitle>
								<RowSub>How wide the conversation reads on large windows</RowSub>
							</RowText>
						</RowLeft>
						<Toggle
							type="button"
							$on={prefs.chatWidth === "wide"}
							onClick={() => setPref("chatWidth", prefs.chatWidth === "wide" ? "comfortable" : "wide")}
							role="switch"
							aria-checked={prefs.chatWidth === "wide"}
							aria-label="Wide chat"
						/>
					</ToggleRow>
					)}
				</Section>

				{!phone && (
					<>
						<SectionHeading>Keyboard</SectionHeading>
						<Section>
							{infoRow("command", "Command palette", `${mod} K: go anywhere, open a chat, change model or theme`)}
							{infoRow("add", "New chat", `${mod} N`)}
							{infoRow("search", "Find in this chat", `${mod} F, and ${mod} Shift F to search all chats`)}
							{infoRow("keyboard_return", "In the message box", "/ for commands, ↑ for earlier messages, Esc to stop a reply")}
						</Section>
					</>
				)}

				<SectionHeading>Connectors</SectionHeading>
				<Section>
					{actionRow(
						"data_object",
						"Connectors",
						phone ? "Documents, Gmail and GitHub" : "Local folders, Gmail and GitHub",
						() => navigate("/connectors"),
						{ chevron: true },
					)}
				</Section>

				<SectionHeading>Downloads</SectionHeading>
				<Section>
					{toggleRow(
						"wifi_only",
						"wifi",
						"WiFi-only downloads",
						isMobile() ? "Never use mobile data for models" : "Applies on phones and tablets",
					)}
				</Section>

				<SectionHeading><Icon name="upload" size={18} color={tokens.colors.primary} />Data, Backup &amp; Cloud Migration</SectionHeading>
				<Section>
					{actionRow(
						"upload",
						busy === "export" ? "Saving backup…" : "Export backup",
						"Save chats and custom characters to a file",
						handleExport,
						{ disabled: busy !== null },
					)}
					{actionRow(
						"download",
						busy === "import" ? "Importing…" : "Import backup",
						"Merge a backup file into this device",
						handleImport,
						{ disabled: busy !== null },
					)}
					<input
						hidden
						ref={cloudInput}
						type="file"
						accept=".json,application/json"
						onChange={(event) => {
							const file = event.currentTarget.files?.[0];
							event.currentTarget.value = "";
							if (file) void handleCloudImport(file);
						}}
					/>
					{actionRow(
						"download",
						busy === "cloud" ? "Importing conversations…" : "Import ChatGPT / Claude (.json)",
						"Copy text turns from a conversations export into local chat history.",
						() => cloudInput.current?.click(),
						{ disabled: busy !== null },
					)}

					{actionRow("delete_sweep", "Clear chat history", "Delete all saved conversations", handleClearHistory, {
						danger: true,
					})}
					{actionRow("restart_alt", "Reset to defaults", "Restore all settings", handleResetDefaults)}
				</Section>

				<SectionHeading>About</SectionHeading>
				<Section>
					{actionRow(
						"info",
						"About Neurix",
						`Version ${import.meta.env.VITE_APP_VERSION ?? "dev"} · source and privacy policy`,
						() => navigate("/about"),
						{ chevron: true },
					)}
				</Section>
			</Page>
			<CharacterPicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
		</AppLayout>
	);
}
