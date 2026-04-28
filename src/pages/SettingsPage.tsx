import { CharacterPicker } from "@/components/character/CharacterPicker";
import { AppLayout } from "@/components/layout/AppLayout";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { useAppContext } from "@/context/AppContext";
import { useCharacters } from "@/context/CharacterContext";
import { accentOf } from "@/utils/characterAccent";
import type { Settings } from "@/services/types";
import { historyService, settingsService } from "@/services";
import { tokens } from "@/theme/tokens";
import { useCallback, useEffect, useState } from "react";
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
	const { activeCharacter } = useCharacters();
	const { showConfirm } = useConfirm();
	const { showToast } = useToast();
	const [pickerOpen, setPickerOpen] = useState(false);
	const [wifiOnly, setWifiOnly] = useState(false);
	const [saveHistory, setSaveHistory] = useState(true);
	const [showSpeed, setShowSpeed] = useState(true);

	useEffect(() => {
		if (settings) {
			setWifiOnly(settings.wifi_only);
			setSaveHistory(settings.save_history);
			setShowSpeed(settings.show_speed);
		}
	}, [settings]);

	const persist = useCallback(
		(patch: Partial<Settings>) => {
			if (!settings) return;
			const updated: Settings = { ...settings, ...patch };
			settingsService.updateSettings(updated)
				.then(() => refreshSettings())
				.catch(() => {
					showToast("Couldn't save setting. Please try again.", "error");
				});
		},
		[settings, refreshSettings, showToast],
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
			wifi_only: true,
			save_history: true,
			show_speed: true,
			system_prompt: "",
			temperature: 0.7,
			top_p: 0.9,
			max_tokens: 512,
			last_model_id: settings?.last_model_id ?? null,
			active_character_id: "preset:default",
			// Keep user's custom characters — resetting settings shouldn't
			// nuke creative work.
			custom_characters: settings?.custom_characters ?? [],
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

				<Section style={{ marginTop: "1rem" }}>
					<ToggleRow onClick={() => setPickerOpen(true)} style={{ cursor: "pointer" }}>
						<RowLeft>
							<RowIcon>
								<Icon
									name={activeCharacter?.icon ?? "auto_awesome"}
									size={18}
									color={accentOf(activeCharacter)}
								/>
							</RowIcon>
							<RowText>
								<RowTitle>Default character</RowTitle>
								<RowSub>
									{activeCharacter
										? `${activeCharacter.name} — ${activeCharacter.description || "Custom"}`
										: "Choose a personality"}
								</RowSub>
							</RowText>
						</RowLeft>
						<Icon name="chevron_right" size={20} color={tokens.colors.onSurfaceVariant} />
					</ToggleRow>
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
			<CharacterPicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
		</AppLayout>
	);
}
