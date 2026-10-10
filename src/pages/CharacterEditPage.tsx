import { AppLayout } from "@/components/layout/AppLayout";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { useAppContext } from "@/context/AppContext";
import { useCharacters } from "@/context/CharacterContext";
import { chatService } from "@/services";
import type { Character, InferenceEvent } from "@/services/types";
import { alpha } from "@/theme/alpha";
import { tokens } from "@/theme/tokens";
import { ACCENT_PALETTE, DEFAULT_ACCENT } from "@/utils/characterAccent";
import { LIMITS } from "@/utils/characterLimits";
import { cleanResponse } from "@/utils/cleanResponse";
import { shortId } from "@/utils/format";
import { vibrate } from "@/utils/platform";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import styled from "styled-components";

/* ── Limits ── */
const NAME_MAX = LIMITS.name;
const DESC_MAX = LIMITS.description;
const PROMPT_SOFT_CAP = LIMITS.promptSoft;
const PROMPT_HARD_CAP = LIMITS.prompt;
const STARTER_MAX = LIMITS.starter;
const STARTER_COUNT = LIMITS.starterCount;
const GREETING_MAX = LIMITS.greeting;

/**
 * Fixed prompt used by the "Try it" button. Deliberately neutral so it
 * exercises the persona without bias toward any character type — short
 * enough that it works inside max_tokens budgets as low as 64.
 */
const TEST_PROMPT = "Say hi and tell me what you're best at, in two short sentences.";

/* ── Prompt example phrases ── Tappable suggestions inserted into the
   personality textarea. Each is a single behaviour rule a small model can
   reliably follow — chosen specifically because they're additive (the user
   keeps stacking phrases) rather than persona descriptions. */
const PROMPT_EXAMPLES: ReadonlyArray<{ short: string; full: string }> = [
	{ short: "Bullet points only", full: "Reply only in bullet points. No prose." },
	{ short: "Plain language", full: "Use plain words. Avoid jargon and filler." },
	{ short: "Ask a follow-up", full: "End every reply with one short follow-up question." },
	{ short: "Short answers", full: "Keep replies under three sentences." },
	{ short: "Step-by-step", full: "Answer in numbered steps when explaining how to do something." },
	{ short: "Cite the source", full: "If you're unsure, say so. Don't invent facts." },
];

/* ── Available icons ── A curated grid from the icon set. We don't expose
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
  border: 1px solid ${alpha(tokens.colors.outlineVariant, "40")};
  border-radius: ${tokens.borderRadius.md};
  color: ${tokens.colors.onSurface};
  font-size: ${tokens.typography.fontSize.base};
  font-family: ${tokens.typography.fontFamily.body};
  outline: none;

  &:focus { border-color: ${alpha(tokens.colors.primary, "80")}; }
`;

const TextArea = styled.textarea`
  width: 100%;
  min-height: 110px;
  padding: 0.75rem 0.875rem;
  background: ${tokens.colors.surfaceContainerHigh};
  border: 1px solid ${alpha(tokens.colors.outlineVariant, "40")};
  border-radius: ${tokens.borderRadius.md};
  color: ${tokens.colors.onSurface};
  font-size: ${tokens.typography.fontSize.base};
  font-family: ${tokens.typography.fontFamily.body};
  line-height: ${tokens.typography.lineHeight.relaxed};
  resize: vertical;
  outline: none;

  &:focus { border-color: ${alpha(tokens.colors.primary, "80")}; }
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
  background: ${alpha(tokens.colors.tertiary, "14")};
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
		$active ? alpha($accent, "14") : tokens.colors.surfaceContainerHigh};
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

const ExampleChips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
`;

const ExampleChip = styled.button`
  padding: 0.375rem 0.625rem;
  border-radius: ${tokens.borderRadius.lg};
  background: ${tokens.colors.surfaceContainerHigh};
  border: 1px dashed ${alpha(tokens.colors.outlineVariant, "80")};
  color: ${tokens.colors.onSurfaceVariant};
  font-size: ${tokens.typography.fontSize.xs};
  font-family: ${tokens.typography.fontFamily.body};
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: transform ${tokens.transitions.fast}, border-color ${tokens.transitions.fast};

  &:hover { border-color: ${tokens.colors.tertiary}; color: ${tokens.colors.onSurface}; }
  &:active { transform: scale(0.96); }
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
    background: ${alpha(tokens.colors.outlineVariant, "40")};
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

const BandLabel = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: ${tokens.typography.fontSize.xs};
  color: ${tokens.colors.onSurfaceVariant};
  margin-top: -0.25rem;

  & > span:last-child {
    color: ${tokens.colors.tertiary};
    font-weight: ${tokens.typography.fontWeight.semibold};
  }
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
  border: 1px solid ${alpha(tokens.colors.error, "80")};
  font-size: ${tokens.typography.fontSize.base};
  font-weight: ${tokens.typography.fontWeight.bold};
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;

  &:active { transform: scale(0.97); background: ${alpha(tokens.colors.error, "10")}; }
`;

/* ── Try it ── */

const TestRow = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
`;

const TestBtn = styled.button<{ $accent: string }>`
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.875rem;
  border-radius: ${tokens.borderRadius.lg};
  background: transparent;
  border: 1px solid ${({ $accent }) => alpha($accent, "60")};
  color: ${({ $accent }) => $accent};
  font-size: ${tokens.typography.fontSize.sm};
  font-weight: ${tokens.typography.fontWeight.bold};
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background ${tokens.transitions.fast}, transform ${tokens.transitions.fast};

  &:disabled { opacity: 0.5; cursor: not-allowed; }
  &:not(:disabled):hover { background: ${({ $accent }) => alpha($accent, "14")}; }
  &:not(:disabled):active { transform: scale(0.96); }
`;

const TestStop = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.875rem;
  border-radius: ${tokens.borderRadius.lg};
  background: transparent;
  border: 1px solid ${alpha(tokens.colors.error, "80")};
  color: ${tokens.colors.error};
  font-size: ${tokens.typography.fontSize.sm};
  font-weight: ${tokens.typography.fontWeight.bold};
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
`;

const TestPanel = styled.div<{ $accent: string }>`
  padding: 0.875rem;
  border-radius: ${tokens.borderRadius.lg};
  background: ${tokens.colors.surfaceContainerHigh};
  border-left: 3px solid ${({ $accent }) => $accent};
  font-size: ${tokens.typography.fontSize.sm};
  color: ${tokens.colors.onSurface};
  line-height: ${tokens.typography.lineHeight.relaxed};
  white-space: pre-wrap;
  word-break: break-word;
`;

const TestEmpty = styled.span`
  color: ${tokens.colors.onSurfaceVariant};
  font-style: italic;
`;

const TestErrorBox = styled.div`
  padding: 0.5rem 0.625rem;
  border-radius: ${tokens.borderRadius.md};
  background: ${alpha(tokens.colors.error, "10")};
  color: ${tokens.colors.error};
  font-size: ${tokens.typography.fontSize.xs};
`;

const SoftCapWarning = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.625rem 0.75rem;
  border-radius: ${tokens.borderRadius.md};
  background: ${alpha(tokens.colors.tertiary, "14")};
  color: ${tokens.colors.onSurface};
  font-size: ${tokens.typography.fontSize.xs};
  line-height: ${tokens.typography.lineHeight.relaxed};
  border-left: 3px solid ${tokens.colors.tertiary};
`;

/* ── Slider helpers ──
 * Plain-language labels so non-technical users can pick values without
 * understanding sampling theory.
 */

function temperatureBand(t: number): string {
	if (t < 0.3) return "Focused";
	if (t < 0.8) return "Balanced";
	if (t < 1.3) return "Creative";
	return "Wild";
}

function topPBand(p: number): string {
	if (p < 0.5) return "Tight";
	if (p < 0.85) return "Standard";
	return "Diverse";
}

function maxTokensBand(n: number): string {
	const words = `≈ ${Math.round(n * 0.75)} words`;
	return n > 768 ? `${words} (long)` : words;
}

const SecondaryBtn = styled.button`
  padding: 0.75rem 1.25rem;
  border-radius: ${tokens.borderRadius.xl};
  border: 1px solid ${tokens.colors.outlineVariant};
  background: transparent;
  color: ${tokens.colors.onSurface};
  font-size: ${tokens.typography.fontSize.sm};
  font-weight: ${tokens.typography.fontWeight.semibold};
  cursor: pointer;

  &:active { transform: scale(0.97); }
`;

interface Draft {
	name: string;
	description: string;
	icon: string;
	accentColor: string;
	prompt: string;
	temperature: number;
	topP: number;
	maxTokens: number;
	greeting: string;
	starters: string[];
}

function padStarters(list: string[] | undefined): string[] {
	const padded = [...(list ?? [])];
	while (padded.length < STARTER_COUNT) padded.push("");
	return padded.slice(0, STARTER_COUNT);
}

function draftFrom(seed: Character | undefined, name: string): Draft {
	return {
		name,
		description: seed?.description ?? "",
		icon: seed?.icon ?? ICON_CHOICES[0],
		accentColor: seed?.accent_color ?? DEFAULT_ACCENT,
		prompt: seed?.system_prompt ?? "",
		temperature: seed?.temperature ?? 0.7,
		topP: seed?.top_p ?? 0.9,
		maxTokens: Math.min(seed?.max_tokens ?? 512, LIMITS.maxTokensMax),
		greeting: seed?.greeting ?? "",
		starters: padStarters(seed?.conversation_starters),
	};
}

/* ── Component ── */

export function CharacterEditPage() {
	const navigate = useNavigate();
	const location = useLocation();
	const params = new URLSearchParams(location.search);
	const idFromQuery = params.get("id");
	const fromTemplateId = params.get("from");
	const isEditing = !!idFromQuery;

	const { allCharacters, customs, saveCustom, deleteCustom, loaded } = useCharacters();
	const { activeModelId } = useAppContext();
	const { showConfirm } = useConfirm();
	const { showToast } = useToast();

	const existing = useMemo(
		() => (idFromQuery ? customs.find((c) => c.id === idFromQuery) : undefined),
		[idFromQuery, customs],
	);

	/**
	 * When the editor is opened with `?from=<id>`, seed every field from that
	 * character but treat it as a brand-new draft (no `existing`, no edit
	 * mode). Skipped when also editing — `?id=` always wins.
	 */
	const template = useMemo(() => {
		if (idFromQuery || !fromTemplateId) return undefined;
		return allCharacters.find((c) => c.id === fromTemplateId);
	}, [idFromQuery, fromTemplateId, allCharacters]);

	const seed = existing ?? template;
	const seedName = existing?.name ?? (template ? `${template.name} (copy)` : "");

	// `initial` is what the form started from; comparing against it tells us
	// whether there is anything unsaved.
	const [initial, setInitial] = useState<Draft>(() => draftFrom(seed, seedName));
	const [draft, setDraft] = useState<Draft>(initial);
	const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
		setDraft((d) => ({ ...d, [key]: value }));

	// Characters load asynchronously; fill the form once the one being edited
	// (or copied) is available. Keyed on the id so later settings refreshes
	// don't wipe what the user is typing.
	const seededFor = useRef<string | null>(seed ? seed.id : null);
	useEffect(() => {
		if (!seed || seededFor.current === seed.id) return;
		seededFor.current = seed.id;
		const next = draftFrom(seed, seedName);
		setInitial(next);
		setDraft(next);
	}, [seed, seedName]);

	const isDirty = JSON.stringify(draft) !== JSON.stringify(initial);

	const leave = async () => {
		if (isDirty) {
			const ok = await showConfirm({
				title: "Discard changes?",
				message: "This character has changes that haven't been saved.",
				confirmLabel: "Discard",
				cancelLabel: "Keep editing",
				danger: true,
			});
			if (!ok) return;
		}
		navigate(-1);
	};

	/* ── Try it (live test) ── */

	const [testing, setTesting] = useState(false);
	const [testOutput, setTestOutput] = useState("");
	const [testError, setTestError] = useState<string | null>(null);
	const testingRef = useRef(false);
	testingRef.current = testing;

	// Stop an in-flight test if the user leaves mid-stream.
	useEffect(() => {
		return () => {
			if (testingRef.current) chatService.stopInference().catch(() => {});
		};
	}, []);

	const onTestEvent = useCallback((event: InferenceEvent) => {
		switch (event.event) {
			case "TokenGenerated":
				setTestOutput((prev) => prev + event.data.token);
				break;
			case "GenerationComplete":
				setTesting(false);
				setTestOutput((prev) => cleanResponse(prev) || prev);
				break;
			case "Error":
				setTesting(false);
				setTestError(event.data.message);
				setTestOutput("");
				break;
			// ContextTrimmed cannot fire here — no history is sent.
		}
	}, []);

	const handleTry = async () => {
		if (testing) return;
		if (!activeModelId) {
			showToast("Load a model from the Models tab to test this character.", "info");
			return;
		}
		const instructions = draft.prompt.trim();
		if (!instructions) {
			showToast("Add some instructions first.", "info");
			return;
		}
		vibrate(8);
		setTestError(null);
		setTestOutput("");
		setTesting(true);
		try {
			await chatService.runInference(
				{
					prompt: TEST_PROMPT,
					systemPrompt: instructions,
					history: [],
					temperature: draft.temperature,
					topP: draft.topP,
					maxTokens: draft.maxTokens,
				},
				onTestEvent,
			);
		} catch (err) {
			setTesting(false);
			setTestError(err instanceof Error ? err.message : String(err));
		}
	};

	const handleStopTest = () => {
		chatService.stopInference().catch(() => {});
		setTesting(false);
	};

	const appendToPrompt = (sentence: string) => {
		setDraft((d) => {
			const trimmed = d.prompt.trim();
			if (!trimmed) return { ...d, prompt: sentence };
			// Avoid double-adding the same sentence.
			if (trimmed.includes(sentence)) return d;
			const sep = /[.!?]$/.test(trimmed) ? " " : ". ";
			const next = `${trimmed}${sep}${sentence}`;
			return next.length > PROMPT_HARD_CAP ? d : { ...d, prompt: next };
		});
	};

	const trimmedName = draft.name.trim();
	const trimmedPrompt = draft.prompt.trim();
	const canSave = trimmedName.length > 0 && trimmedPrompt.length > 0;
	const [saving, setSaving] = useState(false);

	const handleSave = async () => {
		if (!canSave || saving) return;
		const trimmedGreeting = draft.greeting.trim().slice(0, GREETING_MAX);
		const character: Character = {
			id: existing?.id ?? `custom:${shortId()}`,
			name: trimmedName.slice(0, NAME_MAX),
			description: draft.description.trim().slice(0, DESC_MAX),
			icon: draft.icon,
			accent_color: draft.accentColor,
			system_prompt: trimmedPrompt.slice(0, PROMPT_HARD_CAP),
			temperature: draft.temperature,
			top_p: draft.topP,
			max_tokens: draft.maxTokens,
			conversation_starters: draft.starters
				.map((s) => s.trim())
				.filter((s) => s.length > 0)
				.slice(0, STARTER_COUNT),
			...(trimmedGreeting ? { greeting: trimmedGreeting } : {}),
			is_preset: false,
			created_at: existing?.created_at ?? new Date().toISOString(),
			...(existing?.last_used_at ? { last_used_at: existing.last_used_at } : {}),
		};
		setSaving(true);
		try {
			await saveCustom(character);
			showToast(isEditing ? "Character updated" : "Character created", "success");
			vibrate(8);
			navigate(-1);
		} catch {
			showToast("Couldn't save the character. Your changes are still here.", "error");
			setSaving(false);
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

	// Editing a character that no longer exists (deleted, or a stale link):
	// there is nothing to edit, so go back to chat instead of a blank form.
	if (isEditing && loaded && !existing) return <Navigate to="/chat" replace />;

	const { name, description, icon, accentColor, prompt, temperature, topP, maxTokens, greeting, starters } = draft;

	return (
		<AppLayout title={isEditing ? "Edit character" : "New character"} back={leave}>
			<Page>
				<Field>
					<Label id="icon-label">Icon</Label>
					<IconGrid role="radiogroup" aria-labelledby="icon-label">
						{ICON_CHOICES.map((choice) => (
							<IconCell
								key={choice}
								type="button"
								role="radio"
								$active={icon === choice}
								$accent={accentColor}
								onClick={() => set("icon", choice)}
								aria-label={choice.replace(/_/g, " ")}
								aria-checked={icon === choice}
							>
								<Icon name={choice} size={22} />
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
								onClick={() => set("accentColor", c.value)}
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
						onChange={(e) => set("name", e.target.value)}
						required
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
						onChange={(e) => set("description", e.target.value)}
					/>
					<HelperRow>
						<span>One short line under the name.</span>
						<Counter $over={description.length >= DESC_MAX}>
							{description.length}/{DESC_MAX}
						</Counter>
					</HelperRow>
				</Field>

				<Field>
					<Label htmlFor="char-greeting">Greeting (optional)</Label>
					<Input
						id="char-greeting"
						value={greeting}
						maxLength={GREETING_MAX}
						placeholder='e.g. "Hi! What can I help you with?"'
						onChange={(e) => set("greeting", e.target.value)}
					/>
					<HelperRow>
						<span>Shown at the top of a fresh chat.</span>
						<Counter $over={greeting.length >= GREETING_MAX}>
							{greeting.length}/{GREETING_MAX}
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
						onChange={(e) => set("prompt", e.target.value)}
						required
					/>
					<HelperRow>
						<span>Describe tone and style. Short is better.</span>
						<Counter
							$warn={prompt.length > PROMPT_SOFT_CAP && prompt.length < PROMPT_HARD_CAP}
							$over={prompt.length >= PROMPT_HARD_CAP}
						>
							{prompt.length}/{PROMPT_HARD_CAP}
						</Counter>
					</HelperRow>
					{prompt.length > PROMPT_SOFT_CAP && (
						<SoftCapWarning role="status">
							<Icon name="info" size={14} color={tokens.colors.tertiary} />
							<span>
								Long prompts can confuse small models. Try splitting this into
								shorter rules, or remove parts you don't need.
							</span>
						</SoftCapWarning>
					)}
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
					<Label>Try it</Label>
					<TestRow>
						{testing ? (
							<TestStop type="button" onClick={handleStopTest}>
								<Icon name="stop_circle" size={16} color={tokens.colors.error} />
								Stop
							</TestStop>
						) : (
							<TestBtn type="button" onClick={handleTry} disabled={!prompt.trim()} $accent={accentColor}>
								<Icon name="play_arrow" size={16} color={accentColor} />
								Test sample reply
							</TestBtn>
						)}
					</TestRow>
					{(testing || testOutput || testError) &&
						(testError ? (
							<TestErrorBox role="alert">{testError}</TestErrorBox>
						) : (
							<TestPanel $accent={accentColor} aria-live="polite">
								{testOutput || <TestEmpty>Generating…</TestEmpty>}
							</TestPanel>
						))}
				</Field>

				<Field>
					<Label>Add a rule</Label>
					<ExampleChips>
						{PROMPT_EXAMPLES.map((ex) => (
							<ExampleChip
								key={ex.short}
								type="button"
								onClick={() => appendToPrompt(ex.full)}
								title={ex.full}
								aria-label={`Add rule: ${ex.full}`}
							>
								+ {ex.short}
							</ExampleChip>
						))}
					</ExampleChips>
				</Field>

				<Field>
					<Label>Conversation starters (optional)</Label>
					{starters.map((value, idx) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: fixed-length list of slots, never reordered
						<StarterRow key={idx}>
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
								onChange={(e) =>
									set(
										"starters",
										starters.map((s, i) => (i === idx ? e.target.value.slice(0, STARTER_MAX) : s)),
									)
								}
								aria-label={`Starter ${idx + 1}`}
							/>
							<StarterClearBtn
								type="button"
								disabled={value.length === 0}
								aria-label={`Clear starter ${idx + 1}`}
								onClick={() => set("starters", starters.map((s, i) => (i === idx ? "" : s)))}
							>
								<Icon name="close" size={16} />
							</StarterClearBtn>
						</StarterRow>
					))}
					<HelperRow>
						<span>Shown as tappable chips on a fresh chat.</span>
					</HelperRow>
				</Field>

				<SectionDivider>
					<SectionLabel>Advanced</SectionLabel>
				</SectionDivider>

				<SliderRow>
					<SliderHeader>
						<SliderTitle>Creativity</SliderTitle>
						<SliderValue>{temperature.toFixed(2)}</SliderValue>
					</SliderHeader>
					<Slider
						type="range"
						min="0"
						max="2"
						step="0.05"
						value={temperature}
						onChange={(e) => set("temperature", Number.parseFloat(e.target.value))}
						aria-label="Creativity (temperature)"
						aria-valuetext={`${temperatureBand(temperature)} (${temperature.toFixed(2)})`}
					/>
					<BandLabel>
						<span>How varied responses are</span>
						<span>{temperatureBand(temperature)}</span>
					</BandLabel>
				</SliderRow>

				<SliderRow>
					<SliderHeader>
						<SliderTitle>Word variety</SliderTitle>
						<SliderValue>{topP.toFixed(2)}</SliderValue>
					</SliderHeader>
					<Slider
						type="range"
						min="0.05"
						max="1"
						step="0.05"
						value={topP}
						onChange={(e) => set("topP", Number.parseFloat(e.target.value))}
						aria-label="Word variety (top-p)"
						aria-valuetext={`${topPBand(topP)} (${topP.toFixed(2)})`}
					/>
					<BandLabel>
						<span>Vocabulary range</span>
						<span>{topPBand(topP)}</span>
					</BandLabel>
				</SliderRow>

				<SliderRow>
					<SliderHeader>
						<SliderTitle>Reply length</SliderTitle>
						<SliderValue>{maxTokens}</SliderValue>
					</SliderHeader>
					<Slider
						type="range"
						min={LIMITS.maxTokensMin}
						max={LIMITS.maxTokensMax}
						step="32"
						value={maxTokens}
						onChange={(e) => set("maxTokens", Number.parseInt(e.target.value, 10))}
						aria-label="Reply length (max tokens)"
						aria-valuetext={`${maxTokens} tokens, ${maxTokensBand(maxTokens)}`}
					/>
					<BandLabel>
						<span>Maximum tokens</span>
						<span>{maxTokensBand(maxTokens)}</span>
					</BandLabel>
				</SliderRow>

				<Actions>
					{isEditing && existing && (
						<DangerBtn type="button" onClick={handleDelete}>
							Delete
						</DangerBtn>
					)}
					<SecondaryBtn type="button" onClick={leave}>
						Cancel
					</SecondaryBtn>
					<PrimaryBtn type="button" onClick={handleSave} disabled={!canSave || saving}>
						{saving ? "Saving…" : isEditing ? "Save changes" : "Create character"}
					</PrimaryBtn>
				</Actions>
			</Page>
		</AppLayout>
	);
}
