import { AppLayout } from "@/components/layout/AppLayout";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { useCharacters } from "@/context/CharacterContext";
import type { Character } from "@/services/types";
import { tokens } from "@/theme/tokens";
import { ACCENT_PALETTE, DEFAULT_ACCENT, withAlpha } from "@/utils/characterAccent";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import styled from "styled-components";

/* ── Limits ── */
const NAME_MAX = 32;
const DESC_MAX = 60;
const PROMPT_SOFT_CAP = 500; // research: small models choke on long personas
const PROMPT_HARD_CAP = 2000;
const STARTER_MAX = 80;
const STARTER_COUNT = 4;

/* ── Available icons ── A curated grid of Material Symbols. We don't expose
   the full icon font because the picker becomes overwhelming and most icons
   look weird as a "character." ─ */
const ICON_CHOICES = [
	"auto_awesome", "sentiment_satisfied", "business_center", "bolt",
	"school", "palette", "person", "psychology",
	"emoji_objects", "rocket_launch", "self_improvement", "diversity_3",
	"chat", "code", "edit", "menu_book",
	"science", "music_note", "sports_esports", "restaurant",
	"travel_explore", "fitness_center", "savings", "favorite",
];

/* ── Styles ── */

const Page = styled.div`
  padding: 1rem 1.25rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const Label = styled.label`
  font-family: ${tokens.typography.fontFamily.label};
  font-size: ${tokens.typography.fontSize.sm};
  font-weight: ${tokens.typography.fontWeight.bold};
  color: ${tokens.colors.onSurfaceVariant};
`;

const Input = styled.input`
  width: 100%;
  padding: 0.75rem 0.875rem;
  background: ${tokens.colors.surfaceContainerHigh};
  border: 1px solid ${tokens.colors.outlineVariant}40;
  border-radius: ${tokens.borderRadius.md};
  color: ${tokens.colors.onSurface};
  font-size: ${tokens.typography.fontSize.base};
  font-family: ${tokens.typography.fontFamily.body};
  outline: none;

  &:focus { border-color: ${tokens.colors.primary}80; }
`;

const TextArea = styled.textarea`
  width: 100%;
  min-height: 110px;
  padding: 0.75rem 0.875rem;
  background: ${tokens.colors.surfaceContainerHigh};
  border: 1px solid ${tokens.colors.outlineVariant}40;
  border-radius: ${tokens.borderRadius.md};
  color: ${tokens.colors.onSurface};
  font-size: ${tokens.typography.fontSize.base};
  font-family: ${tokens.typography.fontFamily.body};
  line-height: ${tokens.typography.lineHeight.relaxed};
  resize: vertical;
  outline: none;

  &:focus { border-color: ${tokens.colors.primary}80; }
`;

const HelperRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  font-size: ${tokens.typography.fontSize.xs};
  color: ${tokens.colors.onSurfaceVariant};
`;

const Counter = styled.span<{ $over?: boolean; $warn?: boolean }>`
  font-family: ${tokens.typography.fontFamily.mono};
  color: ${({ $over, $warn }) =>
		$over ? tokens.colors.error : $warn ? tokens.colors.tertiary : tokens.colors.onSurfaceVariant};
`;

const Tip = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.625rem 0.75rem;
  background: ${tokens.colors.tertiary}14;
  border-radius: ${tokens.borderRadius.md};
  font-size: ${tokens.typography.fontSize.xs};
  color: ${tokens.colors.onSurfaceVariant};
  line-height: ${tokens.typography.lineHeight.relaxed};
`;

const IconGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 0.5rem;
`;

const IconCell = styled.button<{ $active?: boolean; $accent: string }>`
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: ${tokens.borderRadius.md};
  border: 1.5px solid ${({ $active, $accent }) => ($active ? $accent : "transparent")};
  background: ${({ $active, $accent }) =>
		$active ? withAlpha($accent, "14") : tokens.colors.surfaceContainerHigh};
  color: ${({ $accent }) => $accent};
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: transform ${tokens.transitions.fast}, background ${tokens.transitions.fast};

  &:active { transform: scale(0.93); }
`;

const ColorRow = styled.div`
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
`;

const ColorSwatch = styled.button<{ $color: string; $active: boolean }>`
  width: 36px;
  height: 36px;
  border-radius: ${tokens.borderRadius.circle};
  background: ${({ $color }) => $color};
  border: 2px solid ${({ $active, $color }) =>
		$active ? $color : "transparent"};
  outline: 2px solid ${({ $active }) =>
		$active ? tokens.colors.surface : "transparent"};
  outline-offset: -4px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: transform ${tokens.transitions.fast};
  position: relative;

  &:active { transform: scale(0.9); }

  &::after {
    content: "";
    position: absolute;
    inset: -4px;
    border-radius: ${tokens.borderRadius.circle};
    border: 2px solid ${({ $active, $color }) =>
		$active ? $color : "transparent"};
    pointer-events: none;
  }
`;

const StarterRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const StarterInput = styled(Input)`
  flex: 1;
`;

const StarterClearBtn = styled.button`
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: ${tokens.borderRadius.md};
  border: none;
  background: transparent;
  color: ${tokens.colors.onSurfaceVariant};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background ${tokens.transitions.fast};

  &:hover { background: ${tokens.colors.surfaceContainerHigh}; }
  &:active { transform: scale(0.92); }
  &:disabled { opacity: 0.3; cursor: not-allowed; }
`;

const SectionDivider = styled.div`
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding-top: 0.5rem;

  &::after {
    content: "";
    flex: 1;
    height: 1px;
    background: ${tokens.colors.outlineVariant}40;
  }
`;

const SectionLabel = styled.span`
  font-family: ${tokens.typography.fontFamily.label};
  font-size: ${tokens.typography.fontSize.xs};
  font-weight: ${tokens.typography.fontWeight.bold};
  color: ${tokens.colors.onSurfaceVariant};
  text-transform: uppercase;
  letter-spacing: 0.06em;
`;

const SliderRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const SliderHeader = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: ${tokens.typography.fontSize.sm};
`;

const SliderTitle = styled.span`
  color: ${tokens.colors.onSurface};
  font-weight: ${tokens.typography.fontWeight.medium};
`;

const SliderValue = styled.span`
  font-family: ${tokens.typography.fontFamily.mono};
  color: ${tokens.colors.primary};
  font-weight: ${tokens.typography.fontWeight.bold};
`;

const Slider = styled.input`
  width: 100%;
  accent-color: ${tokens.colors.primary};
`;

const Actions = styled.div`
  display: flex;
  gap: 0.625rem;
  margin-top: 0.5rem;
`;

const PrimaryBtn = styled.button`
  flex: 1;
  padding: 0.875rem;
  border-radius: ${tokens.borderRadius.lg};
  background: ${tokens.colors.primary};
  color: ${tokens.colors.onPrimary};
  border: none;
  font-size: ${tokens.typography.fontSize.base};
  font-weight: ${tokens.typography.fontWeight.bold};
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: transform ${tokens.transitions.fast}, filter 80ms ease-out;

  &:disabled { opacity: 0.5; cursor: not-allowed; }
  &:not(:disabled):active { transform: scale(0.97); filter: brightness(0.9); }
`;

const DangerBtn = styled.button`
  padding: 0.875rem 1.25rem;
  border-radius: ${tokens.borderRadius.lg};
  background: transparent;
  color: ${tokens.colors.error};
  border: 1px solid ${tokens.colors.error}80;
  font-size: ${tokens.typography.fontSize.base};
  font-weight: ${tokens.typography.fontWeight.bold};
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;

  &:active { transform: scale(0.97); background: ${tokens.colors.error}10; }
`;

/* ── Component ── */

function generateId() {
	return `custom:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function CharacterEditPage() {
	const navigate = useNavigate();
	const location = useLocation();
	const idFromQuery = new URLSearchParams(location.search).get("id");
	const isEditing = !!idFromQuery;

	const { customs, saveCustom, deleteCustom } = useCharacters();
	const { showConfirm } = useConfirm();
	const { showToast } = useToast();

	const existing = useMemo(
		() => (idFromQuery ? customs.find((c) => c.id === idFromQuery) : undefined),
		[idFromQuery, customs],
	);

	const [name, setName] = useState(existing?.name ?? "");
	const [description, setDescription] = useState(existing?.description ?? "");
	const [icon, setIcon] = useState(existing?.icon ?? ICON_CHOICES[0]);
	const [accentColor, setAccentColor] = useState(existing?.accent_color ?? DEFAULT_ACCENT);
	const [prompt, setPrompt] = useState(existing?.system_prompt ?? "");
	const [temperature, setTemperature] = useState(existing?.temperature ?? 0.7);
	const [topP, setTopP] = useState(existing?.top_p ?? 0.9);
	const [maxTokens, setMaxTokens] = useState(existing?.max_tokens ?? 512);
	const [starters, setStarters] = useState<string[]>(() => {
		const seed = existing?.conversation_starters ?? [];
		const padded = [...seed];
		while (padded.length < STARTER_COUNT) padded.push("");
		return padded.slice(0, STARTER_COUNT);
	});

	useEffect(() => {
		if (existing) {
			setName(existing.name);
			setDescription(existing.description);
			setIcon(existing.icon);
			setAccentColor(existing.accent_color ?? DEFAULT_ACCENT);
			setPrompt(existing.system_prompt);
			setTemperature(existing.temperature);
			setTopP(existing.top_p);
			setMaxTokens(existing.max_tokens);
			const seed = existing.conversation_starters ?? [];
			const padded = [...seed];
			while (padded.length < STARTER_COUNT) padded.push("");
			setStarters(padded.slice(0, STARTER_COUNT));
		}
	}, [existing]);

	const updateStarter = (idx: number, value: string) => {
		setStarters((prev) => prev.map((s, i) => (i === idx ? value.slice(0, STARTER_MAX) : s)));
	};

	const trimmedName = name.trim();
	const trimmedPrompt = prompt.trim();
	const canSave = trimmedName.length > 0 && trimmedPrompt.length > 0;

	const handleSave = async () => {
		if (!canSave) return;
		const cleanedStarters = starters
			.map((s) => s.trim())
			.filter((s) => s.length > 0)
			.slice(0, STARTER_COUNT);
		const character: Character = {
			id: existing?.id ?? generateId(),
			name: trimmedName.slice(0, NAME_MAX),
			description: description.trim().slice(0, DESC_MAX),
			icon,
			accent_color: accentColor,
			system_prompt: trimmedPrompt.slice(0, PROMPT_HARD_CAP),
			temperature,
			top_p: topP,
			max_tokens: maxTokens,
			conversation_starters: cleanedStarters,
			is_preset: false,
			created_at: existing?.created_at ?? new Date().toISOString(),
		};
		try {
			await saveCustom(character);
			showToast(isEditing ? "Character updated" : "Character created", "success");
			if (navigator.vibrate) navigator.vibrate(8);
			navigate(-1);
		} catch {
			showToast("Couldn't save character", "error");
		}
	};

	const handleDelete = async () => {
		if (!existing) return;
		const ok = await showConfirm({
			title: "Delete character",
			message: `Delete "${existing.name}"? This can't be undone.`,
			confirmLabel: "Delete",
			cancelLabel: "Cancel",
			danger: true,
		});
		if (!ok) return;
		try {
			await deleteCustom(existing.id);
			showToast("Character deleted", "info");
			navigate(-1);
		} catch {
			showToast("Couldn't delete character", "error");
		}
	};

	return (
		<AppLayout title={isEditing ? "Edit character" : "New character"}>
			<Page>
				<Field>
					<Label>Icon</Label>
					<IconGrid>
						{ICON_CHOICES.map((name) => (
							<IconCell
								key={name}
								type="button"
								$active={icon === name}
								$accent={accentColor}
								onClick={() => setIcon(name)}
								aria-label={`Use ${name} icon`}
								aria-pressed={icon === name}
							>
								<Icon name={name} size={22} />
							</IconCell>
						))}
					</IconGrid>
				</Field>

				<Field>
					<Label>Color</Label>
					<ColorRow role="radiogroup" aria-label="Accent color">
						{ACCENT_PALETTE.map((c) => (
							<ColorSwatch
								key={c.value}
								type="button"
								$color={c.value}
								$active={accentColor === c.value}
								onClick={() => setAccentColor(c.value)}
								role="radio"
								aria-checked={accentColor === c.value}
								aria-label={c.label}
							/>
						))}
					</ColorRow>
				</Field>

				<Field>
					<Label htmlFor="char-name">Name</Label>
					<Input
						id="char-name"
						value={name}
						maxLength={NAME_MAX}
						placeholder="e.g. Brainstorm Buddy"
						onChange={(e) => setName(e.target.value)}
					/>
					<HelperRow>
						<span>Shown in the picker.</span>
						<Counter $over={name.length >= NAME_MAX}>
							{name.length}/{NAME_MAX}
						</Counter>
					</HelperRow>
				</Field>

				<Field>
					<Label htmlFor="char-desc">Description (optional)</Label>
					<Input
						id="char-desc"
						value={description}
						maxLength={DESC_MAX}
						placeholder="Brief tagline"
						onChange={(e) => setDescription(e.target.value)}
					/>
					<HelperRow>
						<span>One short line under the name.</span>
						<Counter $over={description.length >= DESC_MAX}>
							{description.length}/{DESC_MAX}
						</Counter>
					</HelperRow>
				</Field>

				<Field>
					<Label htmlFor="char-prompt">Personality / instructions</Label>
					<TextArea
						id="char-prompt"
						value={prompt}
						maxLength={PROMPT_HARD_CAP}
						placeholder='e.g. "Reply in a warm, casual tone. Use plain language and contractions."'
						onChange={(e) => setPrompt(e.target.value)}
					/>
					<HelperRow>
						<span>Describe tone and style — short is better.</span>
						<Counter
							$warn={prompt.length > PROMPT_SOFT_CAP && prompt.length < PROMPT_HARD_CAP}
							$over={prompt.length >= PROMPT_HARD_CAP}
						>
							{prompt.length}/{PROMPT_HARD_CAP}
						</Counter>
					</HelperRow>
				</Field>

				<Tip>
					<Icon name="lightbulb" size={16} color={tokens.colors.tertiary} />
					<span>
						Small models work best with brief, plain-language instructions
						about tone and style. Long roleplay personas can make replies
						less accurate.
					</span>
				</Tip>

				<Field>
					<Label>Conversation starters (optional)</Label>
					{starters.map((value, idx) => (
						<StarterRow key={`starter-${idx}`}>
							<StarterInput
								value={value}
								maxLength={STARTER_MAX}
								placeholder={
									idx === 0
										? "e.g. Help me draft a polite email"
										: idx === 1
											? "e.g. Quiz me on what I just learned"
											: "Optional"
								}
								onChange={(e) => updateStarter(idx, e.target.value)}
								aria-label={`Starter ${idx + 1}`}
							/>
							<StarterClearBtn
								type="button"
								disabled={value.length === 0}
								aria-label={`Clear starter ${idx + 1}`}
								onClick={() => updateStarter(idx, "")}
							>
								<Icon name="close" size={16} />
							</StarterClearBtn>
						</StarterRow>
					))}
					<HelperRow>
						<span>Shown as tappable chips on a fresh chat.</span>
					</HelperRow>
				</Field>

				<SectionDivider><SectionLabel>Advanced</SectionLabel></SectionDivider>

				<SliderRow>
					<SliderHeader>
						<SliderTitle>Temperature</SliderTitle>
						<SliderValue>{temperature.toFixed(2)}</SliderValue>
					</SliderHeader>
					<Slider
						type="range" min="0" max="2" step="0.05"
						value={temperature}
						onChange={(e) => setTemperature(Number.parseFloat(e.target.value))}
					/>
				</SliderRow>

				<SliderRow>
					<SliderHeader>
						<SliderTitle>Top-P</SliderTitle>
						<SliderValue>{topP.toFixed(2)}</SliderValue>
					</SliderHeader>
					<Slider
						type="range" min="0.05" max="1" step="0.05"
						value={topP}
						onChange={(e) => setTopP(Number.parseFloat(e.target.value))}
					/>
				</SliderRow>

				<SliderRow>
					<SliderHeader>
						<SliderTitle>Max tokens</SliderTitle>
						<SliderValue>{maxTokens}</SliderValue>
					</SliderHeader>
					<Slider
						type="range" min="64" max="2048" step="32"
						value={maxTokens}
						onChange={(e) => setMaxTokens(Number.parseInt(e.target.value, 10))}
					/>
				</SliderRow>

				<Actions>
					{isEditing && existing && (
						<DangerBtn type="button" onClick={handleDelete}>Delete</DangerBtn>
					)}
					<PrimaryBtn type="button" onClick={handleSave} disabled={!canSave}>
						{isEditing ? "Save changes" : "Create character"}
					</PrimaryBtn>
				</Actions>
			</Page>
		</AppLayout>
	);
}
