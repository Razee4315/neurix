import { AppLayout } from "@/components/layout/AppLayout";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Icon } from "@/components/ui/Icon";
import { useAppContext } from "@/context/AppContext";
import type { Settings } from "@/services/types";
import { historyService, settingsService } from "@/services";
import { tokens } from "@/theme/tokens";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";

/* ── Styles ── */

const Page = styled.div`
  padding: 1.25rem;
`;

/* ── Toggle Rows ── */

const Section = styled.div`
  background: ${tokens.colors.surfaceContainerLow};
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

const RowSub = styled.div`
  font-size: ${tokens.typography.fontSize.sm};
  color: ${tokens.colors.onSurfaceVariant};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

/* ── Toggle Switch ── */

const Toggle = styled.button<{ $on: boolean }>`
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

/* ── System Prompt ── */

const SectionLabel = styled.h2`
  font-size: ${tokens.typography.fontSize.sm};
  font-weight: ${tokens.typography.fontWeight.semibold};
  color: ${tokens.colors.onSurfaceVariant};
  margin-bottom: 0.5rem;
  padding-left: 0.25rem;
`;

const PromptArea = styled.textarea`
  width: 100%;
  min-height: 100px;
  padding: 0.875rem;
  background: ${tokens.colors.surfaceContainerHighest};
  border: none;
  border-radius: ${tokens.borderRadius.lg};
  font-size: ${tokens.typography.fontSize.base};
  font-family: ${tokens.typography.fontFamily.body};
  color: ${tokens.colors.onSurface};
  resize: vertical;
  outline: none;
  line-height: ${tokens.typography.lineHeight.relaxed};

  &::placeholder { color: ${tokens.colors.outline}; }
  &:focus { box-shadow: inset 0 -2px 0 ${tokens.colors.primary}; }
`;


/* ── Slider ── */

const SliderRow = styled.div`
  padding: 0.75rem 1rem;
`;

const SliderLabel = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
`;

const SliderTitle = styled.span`
  font-size: ${tokens.typography.fontSize.base};
  font-weight: ${tokens.typography.fontWeight.medium};
  color: ${tokens.colors.onSurface};
`;

const SliderValue = styled.span`
  font-family: ${tokens.typography.fontFamily.mono};
  font-size: ${tokens.typography.fontSize.sm};
  color: ${tokens.colors.primary};
  font-weight: ${tokens.typography.fontWeight.bold};
`;

const SliderInput = styled.input`
  width: 100%;
  height: 4px;
  border-radius: 2px;
  outline: none;
  appearance: none;
  background: ${tokens.colors.surfaceContainerHighest};
  cursor: pointer;

  &::-webkit-slider-thumb {
    appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: ${tokens.colors.primary};
    cursor: pointer;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  }
`;

/* ── Version ── */

const VersionFooter = styled.div`
  text-align: center;
  padding: 1.5rem 0 1rem;
  font-size: ${tokens.typography.fontSize.sm};
  color: ${tokens.colors.outline};
  cursor: pointer;

  &:active { opacity: 0.6; }
`;

/* ── Component ── */

export function SettingsPage() {
	const navigate = useNavigate();
	const { settings, refreshSettings } = useAppContext();
	const { showConfirm } = useConfirm();
	const [showInference, setShowInference] = useState(false);
	const [wifiOnly, setWifiOnly] = useState(false);
	const [saveHistory, setSaveHistory] = useState(true);
	const [showSpeed, setShowSpeed] = useState(true);
	const [prompt, setPrompt] = useState("");
	const [temperature, setTemperature] = useState(0.7);
	const [topP, setTopP] = useState(0.9);
	const [maxTokens, setMaxTokens] = useState(2048);
	const promptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const sliderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	// Refs to capture latest values for unmount flush
	const promptRef = useRef(prompt);
	const tempRef = useRef(temperature);
	const topPRef = useRef(topP);
	const maxTokensRef = useRef(maxTokens);

	// Flush any pending debounced saves when leaving the page
	useEffect(() => {
		return () => {
			if (promptTimerRef.current) {
				clearTimeout(promptTimerRef.current);
				// Fire the save with latest values
				if (settings) {
					settingsService.updateSettings({
						...settings,
						system_prompt: promptRef.current,
						temperature: tempRef.current,
						top_p: topPRef.current,
						max_tokens: maxTokensRef.current,
					}).catch(() => {});
				}
			}
			if (sliderTimerRef.current) {
				clearTimeout(sliderTimerRef.current);
			}
		};
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		if (settings) {
			setWifiOnly(settings.wifi_only);
			setSaveHistory(settings.save_history);
			setShowSpeed(settings.show_speed);
			setPrompt(settings.system_prompt);
			setTemperature(settings.temperature);
			setTopP(settings.top_p);
			setMaxTokens(settings.max_tokens);
		}
	}, [settings]);

	const persist = useCallback(
		(patch: Partial<Settings>) => {
			if (!settings) return;
			const updated: Settings = { ...settings, ...patch };
			settingsService.updateSettings(updated).then(() => refreshSettings());
		},
		[settings, refreshSettings],
	);

	const toggleWifi = () => {
		const next = !wifiOnly;
		setWifiOnly(next);
		persist({ wifi_only: next });
	};

	const toggleHistory = () => {
		const next = !saveHistory;
		setSaveHistory(next);
		persist({ save_history: next });
	};

	const toggleSpeed = () => {
		const next = !showSpeed;
		setShowSpeed(next);
		persist({ show_speed: next });
	};

	const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		const val = e.target.value;
		setPrompt(val);
		promptRef.current = val;
		if (promptTimerRef.current) clearTimeout(promptTimerRef.current);
		promptTimerRef.current = setTimeout(() => {
			persist({ system_prompt: val });
			promptTimerRef.current = null;
		}, 500);
	};

	const debouncedSliderPersist = useCallback(
		(patch: Partial<Settings>) => {
			if (sliderTimerRef.current) clearTimeout(sliderTimerRef.current);
			sliderTimerRef.current = setTimeout(() => persist(patch), 300);
		},
		[persist],
	);

	const handleTemperature = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = Number.parseFloat(e.target.value);
		setTemperature(val);
		tempRef.current = val;
		debouncedSliderPersist({ temperature: val });
	};

	const handleTopP = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = Number.parseFloat(e.target.value);
		setTopP(val);
		topPRef.current = val;
		debouncedSliderPersist({ top_p: val });
	};

	const handleMaxTokens = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = Number.parseInt(e.target.value);
		setMaxTokens(val);
		maxTokensRef.current = val;
		debouncedSliderPersist({ max_tokens: val });
	};

	const handleClearHistory = async () => {
		const ok = await showConfirm({
			title: "Clear History",
			message: "Delete all chat history? This cannot be undone.",
			confirmLabel: "Delete All",
			cancelLabel: "Cancel",
			danger: true,
		});
		if (!ok) return;
		if (navigator.vibrate) navigator.vibrate(15);
		try {
			await historyService.clearAllConversations();
		} catch {
			// silent fail
		}
	};

	const handleResetDefaults = async () => {
		const ok = await showConfirm({
			title: "Reset Settings",
			message: "Restore all settings to their default values?",
			confirmLabel: "Reset",
			cancelLabel: "Cancel",
		});
		if (!ok) return;
		const defaults: Settings = {
			wifi_only: false,
			save_history: true,
			show_speed: true,
			system_prompt: "",
			temperature: 0.4,
			top_p: 0.9,
			max_tokens: 512,
			last_model_id: settings?.last_model_id ?? null,
		};
		await settingsService.updateSettings(defaults);
		refreshSettings();
	};

	return (
		<AppLayout title="Settings">
			<Page>

				<Section>
					<ToggleRow>
						<RowLeft>
							<RowIcon>
								<Icon name="wifi" size={18} color={tokens.colors.primary} />
							</RowIcon>
							<RowText>
								<RowTitle>WiFi-only downloads</RowTitle>
								<RowSub>Save mobile data</RowSub>
							</RowText>
						</RowLeft>
						<Toggle
							$on={wifiOnly}
							onClick={toggleWifi}
							role="switch"
							aria-checked={wifiOnly}
							aria-label="WiFi-only downloads"
						/>
					</ToggleRow>

					<ToggleRow>
						<RowLeft>
							<RowIcon>
								<Icon name="history" size={18} color={tokens.colors.primary} />
							</RowIcon>
							<RowText>
								<RowTitle>Save chat history</RowTitle>
								<RowSub>Keep conversations locally</RowSub>
							</RowText>
						</RowLeft>
						<Toggle
							$on={saveHistory}
							onClick={toggleHistory}
							role="switch"
							aria-checked={saveHistory}
							aria-label="Save chat history"
						/>
					</ToggleRow>

					<ToggleRow>
						<RowLeft>
							<RowIcon>
								<Icon name="speed" size={18} color={tokens.colors.primary} />
							</RowIcon>
							<RowText>
								<RowTitle>Show token speed</RowTitle>
								<RowSub>Display inference speed in chat</RowSub>
							</RowText>
						</RowLeft>
						<Toggle
							$on={showSpeed}
							onClick={toggleSpeed}
							role="switch"
							aria-checked={showSpeed}
							aria-label="Show token speed"
						/>
					</ToggleRow>

					</Section>

				<SectionLabel>System Prompt</SectionLabel>
				<PromptArea
					placeholder="Set your AI's personality..."
					value={prompt}
					onChange={handlePromptChange}
				/>

				<Section style={{ marginTop: "1rem" }}>
					<ToggleRow onClick={() => setShowInference(!showInference)} style={{ cursor: "pointer" }}>
						<RowLeft>
							<RowIcon>
								<Icon name="tune" size={18} color={tokens.colors.primary} />
							</RowIcon>
							<RowText>
								<RowTitle>Inference Settings</RowTitle>
								<RowSub>Temperature, Top P, Max Tokens</RowSub>
							</RowText>
						</RowLeft>
						<Icon
							name={showInference ? "expand_less" : "expand_more"}
							size={20}
							color={tokens.colors.onSurfaceVariant}
						/>
					</ToggleRow>

					{showInference && (
						<>
							<SliderRow>
								<SliderLabel>
									<SliderTitle>Temperature</SliderTitle>
									<SliderValue>{temperature.toFixed(2)}</SliderValue>
								</SliderLabel>
								<SliderInput
									type="range"
									min="0"
									max="2"
									step="0.05"
									value={temperature}
									onChange={handleTemperature}
								/>
							</SliderRow>
							<SliderRow>
								<SliderLabel>
									<SliderTitle>Top P</SliderTitle>
									<SliderValue>{topP.toFixed(2)}</SliderValue>
								</SliderLabel>
								<SliderInput
									type="range"
									min="0.1"
									max="1"
									step="0.05"
									value={topP}
									onChange={handleTopP}
								/>
							</SliderRow>
							<SliderRow>
								<SliderLabel>
									<SliderTitle>Max Tokens</SliderTitle>
									<SliderValue>{maxTokens}</SliderValue>
								</SliderLabel>
								<SliderInput
									type="range"
									min="256"
									max="4096"
									step="256"
									value={maxTokens}
									onChange={handleMaxTokens}
								/>
							</SliderRow>
						</>
					)}
				</Section>

				<Section style={{ marginTop: "1rem" }}>
					<ToggleRow onClick={handleClearHistory} style={{ cursor: "pointer" }}>
						<RowLeft>
							<RowIcon>
								<Icon name="delete_sweep" size={18} color={tokens.colors.error} />
							</RowIcon>
							<RowText>
								<RowTitle style={{ color: tokens.colors.error }}>Clear chat history</RowTitle>
								<RowSub>Delete all saved conversations</RowSub>
							</RowText>
						</RowLeft>
					</ToggleRow>
					<ToggleRow onClick={handleResetDefaults} style={{ cursor: "pointer" }}>
						<RowLeft>
							<RowIcon>
								<Icon name="restart_alt" size={18} color={tokens.colors.onSurfaceVariant} />
							</RowIcon>
							<RowText>
								<RowTitle>Reset to defaults</RowTitle>
								<RowSub>Restore all settings</RowSub>
							</RowText>
						</RowLeft>
					</ToggleRow>
				</Section>

				<VersionFooter onClick={() => navigate("/about")}>
					Neurix v{import.meta.env.VITE_APP_VERSION || "0.3.0"}
				</VersionFooter>
			</Page>
		</AppLayout>
	);
}
