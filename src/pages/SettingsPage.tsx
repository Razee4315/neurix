import { CharacterPicker } from "@/components/character/CharacterPicker";
import { AppLayout } from "@/components/layout/AppLayout";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Icon } from "@/components/ui/Icon";
import { ThemePicker } from "@/components/ui/ThemePicker";
import { useToast } from "@/components/ui/Toast";
import { useAppContext } from "@/context/AppContext";
import { useCharacters } from "@/context/CharacterContext";
import { accentOf } from "@/utils/characterAccent";
import type { Settings } from "@/services/types";
import { dataService, historyService, settingsService } from "@/services";
import { FONT_SCALES, type FontSize, isFontSize } from "@/theme/themes";
import { isMobile, vibrate } from "@/utils/platform";
import { tokens } from "@/theme/tokens";
import { useState } from "react";
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
  font-family: ${tokens.typography.fontFamily.label};
  font-size: ${tokens.typography.fontSize.xs};
  font-weight: ${tokens.typography.fontWeight.bold};
  color: ${tokens.colors.onSurfaceVariant};
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin: 1.5rem 0.25rem 0.5rem;

  &:first-child { margin-top: 0; }
`;

const Segments = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.25rem;
  padding: 0.25rem;
  margin-top: 0.75rem;
  border-radius: ${tokens.borderRadius.xl};
  background: ${tokens.colors.surfaceContainerHigh};
`;

const Segment = styled.button<{ $active: boolean; $scale: number }>`
  padding: 0.5rem 0.25rem;
  border: none;
  border-radius: ${tokens.borderRadius.lg};
  background: ${({ $active }) => ($active ? tokens.colors.primary : "transparent")};
  color: ${({ $active }) => ($active ? tokens.colors.onPrimaryFixed : tokens.colors.onSurfaceVariant)};
  font-family: ${tokens.typography.fontFamily.headline};
  font-weight: ${tokens.typography.fontWeight.bold};
  font-size: ${({ $scale }) => 14 * $scale}px;
  cursor: pointer;
  transition: background ${tokens.transitions.fast};
`;

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

type ToggleKey = "wifi_only" | "save_history" | "show_speed";

/* ── Component ── */

export function SettingsPage() {
	const navigate = useNavigate();
	const { settings, settingsFailed, refreshSettings, updateSettings } = useAppContext();
	const { activeCharacter } = useCharacters();
	const { showConfirm } = useConfirm();
	const { showToast } = useToast();
	const [pickerOpen, setPickerOpen] = useState(false);
	const [busy, setBusy] = useState<"export" | "import" | null>(null);
	// Optimistic values shown while a write is in flight. Cleared when the
	// write settles, so a failed save snaps back to the stored value.
	const [pending, setPending] = useState<Partial<Settings>>({});

	const current = <K extends keyof Settings>(key: K): Settings[K] | undefined =>
		key in pending ? (pending[key] as Settings[K]) : settings?.[key];

	const save = async (patch: Partial<Settings>) => {
		setPending((p) => ({ ...p, ...patch }));
		try {
			await updateSettings(patch);
		} catch {
			showToast("Couldn't save that setting. Nothing was changed.", "error");
		} finally {
			setPending((p) => {
				const next = { ...p };
				for (const key of Object.keys(patch)) delete next[key as keyof Settings];
				return next;
			});
		}
	};

	const toggle = (key: ToggleKey) => {
		vibrate(5);
		save({ [key]: !current(key) });
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
			const summary = await dataService.importFromFile();
			if (summary) {
				await refreshSettings();
				showToast(
					`Imported ${summary.conversations} chat${summary.conversations === 1 ? "" : "s"} and ${summary.characters} character${summary.characters === 1 ? "" : "s"}`,
					"success",
				);
			}
		} catch (err) {
			showToast(typeof err === "string" ? err : err instanceof Error ? err.message : "Couldn't import that file", "error");
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

	const toggleRow = (key: ToggleKey, icon: string, title: string, sub: string) => (
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
				$on={!!current(key)}
				onClick={() => toggle(key)}
				role="switch"
				aria-checked={!!current(key)}
				aria-label={title}
			/>
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
				<SectionHeading>Appearance</SectionHeading>
				<ThemePicker value={current("theme") ?? "obsidian"} onChange={(theme) => save({ theme })} />
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
							Aa
						</Segment>
					))}
				</Segments>

				<SectionHeading>Chat</SectionHeading>
				<Section>
					<ActionRow as="button" type="button" onClick={() => setPickerOpen(true)}>
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
					</ActionRow>
					{toggleRow("save_history", "history", "Save chat history", "Keep conversations on this device")}
					{toggleRow("show_speed", "speed", "Show token speed", "Display generation speed under replies")}
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

				<SectionHeading>Your data</SectionHeading>
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
