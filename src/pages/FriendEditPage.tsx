import { AppLayout } from "@/components/layout/AppLayout";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { useAppContext } from "@/context/AppContext";
import { useCharacters } from "@/context/CharacterContext";
import { chatService } from "@/services";
import type { Character, InferenceEvent, Persona } from "@/services/types";
import { alpha } from "@/theme/alpha";
import { tokens } from "@/theme/tokens";
import { ACCENT_PALETTE, accentOf, isAccentHex } from "@/utils/characterAccent";
import { LIMITS } from "@/utils/characterLimits";
import { cleanResponse } from "@/utils/cleanResponse";
import { shortId } from "@/utils/format";
import {
	FORMALITY,
	FRIEND_TEMPLATES,
	type FriendTemplate,
	HUMOR,
	LENGTHS,
	PERSONA_LIMITS,
	RELATIONSHIPS,
	TRAITS,
	compilePersona,
	emptyPersona,
	normalizePersona,
	personaSampling,
	relationshipOf,
} from "@/utils/persona";
import { vibrate } from "@/utils/platform";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import styled from "styled-components";

/**
 * The friend builder: make a character by choosing who they are to you,
 * their personality and how they talk, instead of writing instructions.
 * Every choice is a tap; the free-text fields are optional. A live card
 * shows the friend as it takes shape, and "Say hi" runs it on the loaded
 * model before saving.
 */

const AVATARS = [
	"sentiment_satisfied", "favorite", "auto_awesome", "self_improvement",
	"fitness_center", "school", "menu_book", "psychology",
	"travel_explore", "sports_esports", "restaurant", "music_note",
	"palette", "science", "rocket_launch", "landscape",
	"diversity_3", "smart_toy", "lightbulb", "code",
];

interface Draft {
	name: string;
	tagline: string;
	icon: string;
	accent: string;
	greeting: string;
	persona: Persona;
}

function blankDraft(): Draft {
	return { name: "", tagline: "", icon: AVATARS[0], accent: ACCENT_PALETTE[6].value, greeting: "", persona: emptyPersona() };
}

function draftFromTemplate(t: FriendTemplate): Draft {
	return {
		name: t.name,
		tagline: t.tagline,
		icon: t.icon,
		accent: t.accent,
		greeting: t.greeting,
		persona: { ...t.persona, traits: [...t.persona.traits], memories: [...t.persona.memories] },
	};
}

function draftFromCharacter(c: Character, copy: boolean): Draft {
	return {
		name: copy ? `${c.name} (copy)`.slice(0, LIMITS.name) : c.name,
		tagline: c.description,
		icon: c.icon,
		accent: isAccentHex(c.accent_color) ? c.accent_color : ACCENT_PALETTE[6].value,
		greeting: c.greeting ?? "",
		persona: normalizePersona(c.persona),
	};
}

/* ── Layout ── */

/* Phones: templates, then the live card, then the form. Wide windows keep
   the card in its own column beside everything else. */
const Page = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-areas: "templates" "preview" "form";
  gap: 0.875rem;
  max-width: 64rem;
  margin: 0 auto;
  padding: 1rem 1rem 0;

  @media (min-width: 1100px) {
    grid-template-columns: minmax(0, 1fr) 22rem;
    grid-template-rows: auto 1fr;
    grid-template-areas: "templates preview" "form preview";
    /* Spacing comes from the templates' own margin, so an edit (no
       templates) doesn't start with an empty gap. */
    gap: 0 1.5rem;
    padding: 1.5rem 1.5rem 0;
  }
`;

const Templates = styled.div`
  grid-area: templates;
  min-width: 0;

  @media (min-width: 1100px) { margin-bottom: 0.875rem; }
`;

const Form = styled.div`
  grid-area: form;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  min-width: 0;
`;

const Aside = styled.aside`
  grid-area: preview;
  min-width: 0;
  align-self: start;

  @media (min-width: 1100px) {
    position: sticky;
    top: 1.5rem;
    align-self: start;
  }
`;

const Card = styled.section`
  background: ${tokens.colors.surfaceContainer};
  border: 1px solid ${alpha(tokens.colors.outlineVariant, "80")};
  border-radius: ${tokens.borderRadius.xl};
  padding: 1rem 1rem 1.125rem;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;

  @media (min-width: 600px) { padding: 1.125rem 1.25rem 1.25rem; }
`;

const CardHead = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.125rem;

  h2 {
    margin: 0;
    font-family: ${tokens.typography.fontFamily.headline};
    font-size: ${tokens.typography.fontSize.md};
    font-weight: ${tokens.typography.fontWeight.semibold};
    color: ${tokens.colors.onSurface};
  }

  p {
    margin: 0;
    font-size: ${tokens.typography.fontSize.sm};
    line-height: 1.45;
    color: ${tokens.colors.onSurfaceVariant};
  }
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
`;

const LabelRow = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
`;

const Label = styled.label`
  font-size: ${tokens.typography.fontSize.sm};
  font-weight: ${tokens.typography.fontWeight.medium};
  color: ${tokens.colors.onSurface};
`;

const Count = styled.span<{ $warn?: boolean }>`
  font-size: ${tokens.typography.fontSize.xs};
  font-variant-numeric: tabular-nums;
  color: ${({ $warn }) => ($warn ? tokens.colors.error : tokens.colors.onSurfaceVariant)};
`;

const fieldBase = `
  width: 100%;
  padding: 0.6875rem 0.8125rem;
  background: ${tokens.colors.surfaceContainerLowest};
  border: 1px solid ${alpha(tokens.colors.outlineVariant, "cc")};
  border-radius: ${tokens.borderRadius.lg};
  color: ${tokens.colors.onSurface};
  font-family: ${tokens.typography.fontFamily.body};
  font-size: ${tokens.typography.fontSize.base};
  outline: none;
  transition: border-color ${tokens.transitions.fast};

  &:focus { border-color: ${tokens.colors.outline}; }
  &::placeholder { color: ${tokens.colors.outline}; }

  /* 16px keeps phone browsers from zooming into the field. */
  @media (pointer: coarse) { font-size: 16px; }
`;

const Input = styled.input`
  ${fieldBase}
`;

const TextArea = styled.textarea`
  ${fieldBase}
  min-height: 92px;
  line-height: 1.55;
  resize: vertical;
`;

const Hint = styled.p`
  margin: 0;
  font-size: ${tokens.typography.fontSize.xs};
  line-height: 1.5;
  color: ${tokens.colors.onSurfaceVariant};
`;

/* ── Templates ── */

const TemplateStrip = styled.div`
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  margin: 0 -1rem;
  padding: 0.125rem 1rem 0.25rem;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }

  @media (min-width: 600px) {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    margin: 0;
    padding: 0;
  }
`;

const TemplateBtn = styled.button<{ $accent: string; $on: boolean }>`
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  grid-template-rows: auto auto;
  column-gap: 0.5rem;
  align-items: center;
  padding: 0.5rem 0.75rem 0.5rem 0.5rem;
  border-radius: ${tokens.borderRadius.lg};
  border: 1px solid ${({ $on, $accent }) => ($on ? $accent : alpha(tokens.colors.outlineVariant, "cc"))};
  background: ${({ $on, $accent }) => ($on ? alpha($accent, "1a") : tokens.colors.surfaceContainerLow)};
  color: ${tokens.colors.onSurface};
  text-align: left;
  cursor: pointer;
  transition: border-color ${tokens.transitions.fast}, background ${tokens.transitions.fast};

  &:hover { border-color: ${({ $accent }) => $accent}; }

  > :first-child { grid-row: 1 / 3; }
  strong {
    font-size: ${tokens.typography.fontSize.sm};
    font-weight: ${tokens.typography.fontWeight.semibold};
    white-space: nowrap;
  }
  > span:last-child {
    font-size: ${tokens.typography.fontSize.xs};
    color: ${tokens.colors.onSurfaceVariant};
  }
`;

const MiniAvatar = styled.span<{ $accent: string; $size?: number }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: ${({ $size }) => $size ?? 32}px;
  height: ${({ $size }) => $size ?? 32}px;
  border-radius: 50%;
  background: ${({ $accent }) => alpha($accent, "26")};
  color: ${({ $accent }) => $accent};
  flex-shrink: 0;
`;

/* ── Choice controls ── */

const ChipWrap = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.4375rem;
`;

const Chip = styled.button<{ $on: boolean; $accent: string }>`
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  min-height: 34px;
  padding: 0 0.8125rem;
  border-radius: ${tokens.borderRadius.circle};
  border: 1px solid ${({ $on, $accent }) => ($on ? $accent : alpha(tokens.colors.outlineVariant, "cc"))};
  background: ${({ $on, $accent }) => ($on ? alpha($accent, "1f") : "transparent")};
  color: ${({ $on, $accent }) => ($on ? $accent : tokens.colors.onSurface)};
  font-size: ${tokens.typography.fontSize.sm};
  font-weight: ${({ $on }) => ($on ? tokens.typography.fontWeight.semibold : tokens.typography.fontWeight.regular)};
  cursor: pointer;
  transition: background ${tokens.transitions.fast}, border-color ${tokens.transitions.fast};

  &:disabled { opacity: 0.4; cursor: default; }
  &:not(:disabled):hover { border-color: ${({ $accent }) => $accent}; }
  @media (pointer: coarse) { min-height: 38px; }
`;

const RelGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.4375rem;

  @media (min-width: 600px) { grid-template-columns: repeat(5, minmax(0, 1fr)); }
`;

const RelBtn = styled.button<{ $on: boolean; $accent: string }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 44px;
  padding: 0.5rem 0.625rem;
  border-radius: ${tokens.borderRadius.lg};
  border: 1px solid ${({ $on, $accent }) => ($on ? $accent : alpha(tokens.colors.outlineVariant, "cc"))};
  background: ${({ $on, $accent }) => ($on ? alpha($accent, "1a") : tokens.colors.surfaceContainerLow)};
  color: ${({ $on, $accent }) => ($on ? $accent : tokens.colors.onSurface)};
  font-size: ${tokens.typography.fontSize.sm};
  font-weight: ${({ $on }) => ($on ? tokens.typography.fontWeight.semibold : tokens.typography.fontWeight.regular)};
  text-align: left;
  cursor: pointer;

  span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  &:hover { border-color: ${({ $accent }) => $accent}; }
`;

const AvatarGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
  gap: 0.375rem;
`;

const AvatarBtn = styled.button<{ $on: boolean; $accent: string }>`
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 1.5px solid ${({ $on, $accent }) => ($on ? $accent : "transparent")};
  background: ${({ $on, $accent }) => ($on ? alpha($accent, "26") : tokens.colors.surfaceContainerHigh)};
  color: ${({ $on, $accent }) => ($on ? $accent : tokens.colors.onSurfaceVariant)};
  cursor: pointer;

  &:hover { color: ${({ $accent }) => $accent}; }
`;

const Swatches = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
`;

const Swatch = styled.button<{ $color: string; $on: boolean }>`
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 2px solid ${({ $on }) => ($on ? tokens.colors.onSurface : "transparent")};
  background: ${({ $color }) => $color};
  background-clip: content-box;
  padding: 3px;
  cursor: pointer;

  @media (pointer: coarse) { width: 36px; height: 36px; }
`;

const ScaleRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.4375rem;
`;

const ScaleHead = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  font-size: ${tokens.typography.fontSize.sm};
  color: ${tokens.colors.onSurface};

  b {
    font-weight: ${tokens.typography.fontWeight.semibold};
  }
`;

const ScaleTrack = styled.div`
  display: flex;
  gap: 0.25rem;
`;

const ScaleStep = styled.button<{ $on: boolean; $filled: boolean; $accent: string }>`
  flex: 1;
  height: 30px;
  border: none;
  border-radius: ${tokens.borderRadius.md};
  background: ${({ $on, $filled, $accent }) =>
		$on ? $accent : $filled ? alpha($accent, "40") : tokens.colors.surfaceContainerHighest};
  cursor: pointer;
  transition: background ${tokens.transitions.fast};

  &:hover { background: ${({ $on, $accent }) => ($on ? $accent : alpha($accent, "66"))}; }
`;

const ScaleEnds = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: ${tokens.typography.fontSize.xs};
  color: ${tokens.colors.onSurfaceVariant};
`;

const ToggleRow = styled.label`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: ${tokens.typography.fontSize.sm};
  color: ${tokens.colors.onSurface};
  cursor: pointer;
`;

const Switch = styled.button<{ $on: boolean; $accent: string }>`
  position: relative;
  width: 40px;
  height: 22px;
  border: none;
  border-radius: 11px;
  background: ${({ $on, $accent }) => ($on ? $accent : tokens.colors.surfaceContainerHighest)};
  cursor: pointer;
  flex-shrink: 0;

  &::after {
    content: "";
    position: absolute;
    top: 3px;
    left: ${({ $on }) => ($on ? "21px" : "3px")};
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #ffffff;
    transition: left ${tokens.transitions.fast};
  }
`;

const MemoryList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
`;

const MemoryItem = styled.li`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.375rem 0.5rem 0.75rem;
  border-radius: ${tokens.borderRadius.lg};
  background: ${tokens.colors.surfaceContainerLow};
  border: 1px solid ${alpha(tokens.colors.outlineVariant, "80")};
  font-size: ${tokens.typography.fontSize.sm};
  color: ${tokens.colors.onSurface};

  span { flex: 1; min-width: 0; overflow-wrap: anywhere; }
`;

const IconBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: ${tokens.borderRadius.md};
  background: transparent;
  color: ${tokens.colors.onSurfaceVariant};
  cursor: pointer;
  flex-shrink: 0;

  &:hover { background: ${tokens.colors.surfaceContainerHighest}; color: ${tokens.colors.onSurface}; }
  @media (pointer: coarse) { width: 40px; height: 40px; }
`;

const AddRow = styled.form`
  display: flex;
  gap: 0.5rem;
`;

const SmallBtn = styled.button`
  flex-shrink: 0;
  padding: 0 0.875rem;
  border-radius: ${tokens.borderRadius.lg};
  border: 1px solid ${alpha(tokens.colors.outlineVariant, "cc")};
  background: ${tokens.colors.surfaceContainerHigh};
  color: ${tokens.colors.onSurface};
  font-size: ${tokens.typography.fontSize.sm};
  font-weight: ${tokens.typography.fontWeight.medium};
  cursor: pointer;

  &:disabled { opacity: 0.5; cursor: default; }
`;

/* ── Preview ── */

const Preview = styled.div<{ $accent: string }>`
  background: ${tokens.colors.surfaceContainer};
  border: 1px solid ${alpha(tokens.colors.outlineVariant, "80")};
  border-top: 3px solid ${({ $accent }) => $accent};
  border-radius: ${tokens.borderRadius.xl};
  padding: 1.125rem 1rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
`;

const PreviewTop = styled.div`
  display: flex;
  align-items: center;
  gap: 0.875rem;
`;

const PreviewName = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;

  strong {
    font-family: ${tokens.typography.fontFamily.headline};
    font-size: ${tokens.typography.fontSize.xl};
    font-weight: ${tokens.typography.fontWeight.semibold};
    color: ${tokens.colors.onSurface};
    overflow-wrap: anywhere;
  }

  span {
    font-size: ${tokens.typography.fontSize.sm};
    color: ${tokens.colors.onSurfaceVariant};
    line-height: 1.4;
  }
`;

const Tags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.3125rem;
`;

const Tag = styled.span<{ $accent?: string }>`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  height: 24px;
  padding: 0 0.5625rem;
  border-radius: ${tokens.borderRadius.circle};
  font-size: ${tokens.typography.fontSize.xs};
  font-weight: ${tokens.typography.fontWeight.medium};
  background: ${({ $accent }) => ($accent ? alpha($accent, "1f") : tokens.colors.surfaceContainerHigh)};
  color: ${({ $accent }) => $accent ?? tokens.colors.onSurfaceVariant};
`;

const Thread = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-top: 0.75rem;
  border-top: 1px solid ${alpha(tokens.colors.outlineVariant, "80")};
`;

const Bubble = styled.div<{ $mine?: boolean }>`
  align-self: ${({ $mine }) => ($mine ? "flex-end" : "flex-start")};
  max-width: 88%;
  padding: 0.5625rem 0.8125rem;
  border-radius: ${({ $mine }) => ($mine ? "14px 14px 4px 14px" : "14px 14px 14px 4px")};
  background: ${({ $mine }) => ($mine ? tokens.colors.surfaceContainerLowest : tokens.colors.surfaceContainerHigh)};
  color: ${tokens.colors.onSurface};
  font-size: ${tokens.typography.fontSize.sm};
  line-height: 1.5;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
`;

const Faint = styled.span`
  color: ${tokens.colors.onSurfaceVariant};
  font-style: italic;
`;

const StyleLine = styled.div`
  font-size: ${tokens.typography.fontSize.xs};
  color: ${tokens.colors.onSurfaceVariant};
`;

/* ── Bottom bar ── */

const Bar = styled.div`
  position: sticky;
  bottom: 0;
  z-index: 2;
  margin-top: 1rem;
  padding: 0.75rem 1rem calc(0.75rem + env(safe-area-inset-bottom, 0px));
  background: ${tokens.colors.background};
  border-top: 1px solid ${alpha(tokens.colors.outlineVariant, "80")};
`;

const BarInner = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  max-width: 64rem;
  margin: 0 auto;
`;

const BarSpacer = styled.div`
  flex: 1;
`;

const GhostBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  height: 42px;
  padding: 0 1rem;
  border-radius: ${tokens.borderRadius.lg};
  border: 1px solid ${alpha(tokens.colors.outlineVariant, "cc")};
  background: transparent;
  color: ${tokens.colors.onSurface};
  font-size: ${tokens.typography.fontSize.sm};
  font-weight: ${tokens.typography.fontWeight.medium};
  cursor: pointer;

  &:hover { background: ${tokens.colors.surfaceContainerHigh}; }
  &:disabled { opacity: 0.5; cursor: default; }
`;

const DangerBtn = styled(GhostBtn)`
  color: ${tokens.colors.error};
`;

const SaveBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  height: 42px;
  padding: 0 1.25rem;
  border-radius: ${tokens.borderRadius.lg};
  border: none;
  background: ${tokens.colors.primary};
  color: ${tokens.colors.onPrimaryFixed};
  font-size: ${tokens.typography.fontSize.sm};
  font-weight: ${tokens.typography.fontWeight.semibold};
  cursor: pointer;

  &:hover { background: ${tokens.colors.primaryDim}; }
  &:disabled { opacity: 0.5; cursor: default; }
`;

/* ── Small pieces ── */

function Scale({
	title,
	labels,
	value,
	accent,
	onChange,
}: {
	title: string;
	labels: readonly string[];
	value: number;
	accent: string;
	onChange: (v: number) => void;
}) {
	return (
		<ScaleRow role="radiogroup" aria-label={title}>
			<ScaleHead>
				<span>{title}</span>
				<b style={{ color: accent }}>{labels[value]}</b>
			</ScaleHead>
			<ScaleTrack>
				{labels.map((label, i) => (
					<ScaleStep
						key={label}
						type="button"
						role="radio"
						aria-checked={i === value}
						aria-label={label}
						title={label}
						$on={i === value}
						$filled={i < value}
						$accent={accent}
						onClick={() => onChange(i)}
					/>
				))}
			</ScaleTrack>
			<ScaleEnds>
				<span>{labels[0]}</span>
				<span>{labels[labels.length - 1]}</span>
			</ScaleEnds>
		</ScaleRow>
	);
}

const TEST_MESSAGE = (you: string) =>
	`Hey${you ? `, it's ${you}` : ""}! Say hi and tell me a little about yourself.`;

/* ── Page ── */

export function FriendEditPage() {
	const navigate = useNavigate();
	const location = useLocation();
	const params = new URLSearchParams(location.search);
	const editId = params.get("id");
	const fromId = params.get("from");
	const isEditing = !!editId;

	const { allCharacters, customs, saveCustom, deleteCustom, setActiveCharacter, loaded } = useCharacters();
	const { activeModelId } = useAppContext();
	const { showConfirm } = useConfirm();
	const { showToast } = useToast();

	const existing = useMemo(() => (editId ? customs.find((c) => c.id === editId) : undefined), [editId, customs]);
	const copyOf = useMemo(
		() => (!editId && fromId ? allCharacters.find((c) => c.id === fromId && c.persona) : undefined),
		[editId, fromId, allCharacters],
	);
	const seed = existing ?? copyOf;

	const [initial, setInitial] = useState<Draft>(() =>
		seed ? draftFromCharacter(seed, !existing) : draftFromTemplate(FRIEND_TEMPLATES[0]),
	);
	const [draft, setDraft] = useState<Draft>(initial);
	const [templateId, setTemplateId] = useState<string | null>(seed ? null : FRIEND_TEMPLATES[0].id);
	const [memoryInput, setMemoryInput] = useState("");
	const [testing, setTesting] = useState(false);
	const [testReply, setTestReply] = useState("");
	const [testError, setTestError] = useState<string | null>(null);
	const [testAsked, setTestAsked] = useState("");

	// Characters load asynchronously: fill the form once the friend being
	// edited or copied is there, without wiping later typing.
	const seededFor = useRef<string | null>(seed ? seed.id : null);
	useEffect(() => {
		if (!seed || seededFor.current === seed.id) return;
		seededFor.current = seed.id;
		const next = draftFromCharacter(seed, !existing);
		setInitial(next);
		setDraft(next);
		setTemplateId(null);
	}, [seed, existing]);

	const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
	const setP = <K extends keyof Persona>(key: K, value: Persona[K]) =>
		setDraft((d) => ({ ...d, persona: { ...d.persona, [key]: value } }));

	const isDirty = JSON.stringify(draft) !== JSON.stringify(initial);
	const accent = accentOf({ accent_color: draft.accent } as Character);
	const rel = relationshipOf(draft.persona);
	const p = draft.persona;

	const applyTemplate = (t: FriendTemplate) => {
		vibrate(5);
		setTemplateId(t.id);
		// Keep what the user already said about themselves.
		setDraft((d) => {
			const next = draftFromTemplate(t);
			return { ...next, persona: { ...next.persona, user_name: d.persona.user_name, memories: d.persona.memories } };
		});
		setTestAsked("");
		setTestReply("");
		setTestError(null);
	};

	const toggleTrait = (id: string) => {
		const has = p.traits.includes(id);
		if (!has && p.traits.length >= PERSONA_LIMITS.traits) return;
		setP("traits", has ? p.traits.filter((t) => t !== id) : [...p.traits, id]);
	};

	const addMemory = (e: React.FormEvent) => {
		e.preventDefault();
		const m = memoryInput.trim().slice(0, PERSONA_LIMITS.memory);
		if (!m || p.memories.length >= PERSONA_LIMITS.memories) return;
		setP("memories", [...p.memories, m]);
		setMemoryInput("");
	};

	const leave = async () => {
		if (isDirty) {
			const ok = await showConfirm({
				title: "Discard this friend?",
				message: "Your changes haven't been saved.",
				confirmLabel: "Discard",
				cancelLabel: "Keep editing",
				danger: true,
			});
			if (!ok) return;
		}
		navigate(-1);
	};

	/* ── Say hi (test on the loaded model) ── */

	const testingRef = useRef(false);
	testingRef.current = testing;

	useEffect(() => {
		return () => {
			if (testingRef.current) chatService.stopInference().catch(() => {});
		};
	}, []);

	const onTestEvent = useCallback((event: InferenceEvent) => {
		switch (event.event) {
			case "TokenGenerated":
				setTestReply((prev) => prev + event.data.token);
				break;
			case "GenerationComplete":
				setTesting(false);
				setTestReply((prev) => cleanResponse(prev) || prev);
				break;
			case "Error":
				setTesting(false);
				setTestError(event.data.message);
				setTestReply("");
				break;
		}
	}, []);

	const name = draft.name.trim();
	const systemPrompt = compilePersona(name, draft.tagline, p).slice(0, LIMITS.prompt);

	const sayHi = async () => {
		if (testing) {
			chatService.stopInference().catch(() => {});
			setTesting(false);
			return;
		}
		if (!activeModelId) {
			showToast("Load a model from the Models tab to hear from your friend.", "info");
			return;
		}
		vibrate(8);
		const message = TEST_MESSAGE(p.user_name.trim());
		setTestAsked(message);
		setTestError(null);
		setTestReply("");
		setTesting(true);
		const sampling = personaSampling(p);
		try {
			await chatService.runInference(
				{
					prompt: message,
					systemPrompt,
					history: [],
					temperature: sampling.temperature,
					topP: sampling.top_p,
					maxTokens: sampling.max_tokens,
				},
				onTestEvent,
			);
		} catch (err) {
			setTesting(false);
			setTestError(err instanceof Error ? err.message : String(err));
		}
	};

	/* ── Save and delete ── */

	const [saving, setSaving] = useState(false);
	const canSave = name.length > 0 && !saving;

	const save = async () => {
		if (!canSave) return;
		const greeting = draft.greeting.trim().slice(0, LIMITS.greeting);
		const persona: Persona = {
			...p,
			backstory: p.backstory.trim(),
			style: p.style.trim(),
			user_name: p.user_name.trim(),
		};
		const character: Character = {
			id: existing?.id ?? `custom:${shortId()}`,
			name: name.slice(0, LIMITS.name),
			description: draft.tagline.trim().slice(0, LIMITS.description),
			icon: draft.icon,
			accent_color: draft.accent,
			system_prompt: compilePersona(name, draft.tagline, persona).slice(0, LIMITS.prompt),
			...personaSampling(persona),
			conversation_starters: relationshipOf(persona).starters.slice(0, LIMITS.starterCount),
			...(greeting ? { greeting } : {}),
			is_preset: false,
			persona,
			created_at: existing?.created_at ?? new Date().toISOString(),
			...(existing?.last_used_at ? { last_used_at: existing.last_used_at } : {}),
		};
		setSaving(true);
		try {
			await saveCustom(character);
			vibrate(8);
			if (isEditing) {
				showToast(`${character.name} updated`, "success");
				setInitial(draft);
				navigate(-1);
			} else {
				await setActiveCharacter(character.id).catch(() => {});
				showToast(`${character.name} is ready to chat`, "success");
				setInitial(draft);
				navigate("/chat", { replace: true });
			}
		} catch {
			showToast("Couldn't save your friend. Your changes are still here.", "error");
			setSaving(false);
		}
	};

	const remove = async () => {
		if (!existing) return;
		const ok = await showConfirm({
			title: `Delete ${existing.name}?`,
			message: "Your chats stay in history, but this friend is gone for good.",
			confirmLabel: "Delete",
			cancelLabel: "Cancel",
			danger: true,
		});
		if (!ok) return;
		try {
			await deleteCustom(existing.id);
			showToast(`${existing.name} deleted`, "info");
			navigate(-1);
		} catch {
			showToast("Couldn't delete this friend", "error");
		}
	};

	if (isEditing && loaded && !existing) return <Navigate to="/chat" replace />;

	const traitLabels = p.traits.map((id) => TRAITS.find((t) => t.id === id)?.label).filter(Boolean) as string[];
	const styleSummary = [
		FORMALITY[p.formality],
		HUMOR[p.humor],
		`${LENGTHS[p.length].toLowerCase()} replies`,
		p.emoji ? "emojis" : null,
	]
		.filter(Boolean)
		.join(" · ");

	return (
		<AppLayout title={isEditing ? `Edit ${existing?.name ?? "friend"}` : "New friend"} back={leave}>
			<Page>
				{!isEditing && (
					<Templates>
					<Card>
						<CardHead>
							<h2>Start from someone</h2>
							<p>Pick a starting point. You can change everything below.</p>
						</CardHead>
						<TemplateStrip>
							{FRIEND_TEMPLATES.map((t) => {
								const a = accentOf({ accent_color: t.accent } as Character);
								return (
									<TemplateBtn
										key={t.id}
										type="button"
										$accent={a}
										$on={templateId === t.id}
										aria-pressed={templateId === t.id}
										onClick={() => applyTemplate(t)}
									>
										<MiniAvatar $accent={a}>
											<Icon name={t.icon} size={16} />
										</MiniAvatar>
										<strong>{t.label}</strong>
										<span>{t.name}</span>
									</TemplateBtn>
								);
							})}
						</TemplateStrip>
					</Card>
					</Templates>
				)}
				<Aside>
					<Preview $accent={accent} aria-live="polite">
						<PreviewTop>
							<MiniAvatar $accent={accent} $size={60}>
								<Icon name={draft.icon} size={28} />
							</MiniAvatar>
							<PreviewName>
								<strong>{name || "Your friend"}</strong>
								<span>{draft.tagline.trim() || "Give them a one-line description"}</span>
							</PreviewName>
						</PreviewTop>
						<Tags>
							<Tag $accent={accent}>
								<Icon name={rel.icon} size={12} />
								{rel.label}
							</Tag>
							{traitLabels.map((t) => (
								<Tag key={t}>{t}</Tag>
							))}
						</Tags>
						<StyleLine>Talks: {styleSummary}</StyleLine>
						<Thread>
							{draft.greeting.trim() ? (
								<Bubble>{draft.greeting.trim()}</Bubble>
							) : (
								<Bubble>
									<Faint>Their first message shows here</Faint>
								</Bubble>
							)}
							{testAsked && <Bubble $mine>{testAsked}</Bubble>}
							{testAsked && (
								<Bubble>
									{testError ? (
										<Faint>{testError}</Faint>
									) : testReply ? (
										testReply
									) : (
										<Faint>typing…</Faint>
									)}
								</Bubble>
							)}
						</Thread>
					</Preview>
				</Aside>

				<Form>
					<Card>
						<CardHead>
							<h2>Who they are</h2>
						</CardHead>
						<Field>
							<LabelRow>
								<Label htmlFor="friend-name">Name</Label>
								<Count $warn={draft.name.length >= LIMITS.name}>
									{draft.name.length}/{LIMITS.name}
								</Count>
							</LabelRow>
							<Input
								id="friend-name"
								value={draft.name}
								maxLength={LIMITS.name}
								placeholder="Sam"
								autoComplete="off"
								onChange={(e) => set("name", e.target.value)}
							/>
						</Field>
						<Field>
							<LabelRow>
								<Label htmlFor="friend-tagline">In one line</Label>
								<Count>
									{draft.tagline.length}/{LIMITS.description}
								</Count>
							</LabelRow>
							<Input
								id="friend-tagline"
								value={draft.tagline}
								maxLength={LIMITS.description}
								placeholder="Always up for a chat, never judges"
								autoComplete="off"
								onChange={(e) => set("tagline", e.target.value)}
							/>
						</Field>
						<Field>
							<Label as="span">Look</Label>
							<AvatarGrid role="radiogroup" aria-label="Avatar">
								{AVATARS.map((icon) => (
									<AvatarBtn
										key={icon}
										type="button"
										role="radio"
										aria-checked={draft.icon === icon}
										aria-label={icon.replace(/_/g, " ")}
										$on={draft.icon === icon}
										$accent={accent}
										onClick={() => set("icon", icon)}
									>
										<Icon name={icon} size={18} />
									</AvatarBtn>
								))}
							</AvatarGrid>
							<Swatches role="radiogroup" aria-label="Color">
								{ACCENT_PALETTE.map((c) => (
									<Swatch
										key={c.value}
										type="button"
										role="radio"
										aria-checked={draft.accent === c.value}
										aria-label={c.label}
										title={c.label}
										$color={accentOf({ accent_color: c.value } as Character)}
										$on={draft.accent === c.value}
										onClick={() => set("accent", c.value)}
									/>
								))}
							</Swatches>
						</Field>
					</Card>

					<Card>
						<CardHead>
							<h2>You and {name || "them"}</h2>
							<p>What they are to you sets how they treat you.</p>
						</CardHead>
						<RelGrid role="radiogroup" aria-label="Relationship">
							{RELATIONSHIPS.map((r) => (
								<RelBtn
									key={r.id}
									type="button"
									role="radio"
									aria-checked={p.relationship === r.id}
									$on={p.relationship === r.id}
									$accent={accent}
									onClick={() => setP("relationship", r.id)}
								>
									<Icon name={r.icon} size={16} />
									<span>{r.label}</span>
								</RelBtn>
							))}
						</RelGrid>
						<Field>
							<Label htmlFor="friend-you">What should they call you?</Label>
							<Input
								id="friend-you"
								value={p.user_name}
								maxLength={PERSONA_LIMITS.userName}
								placeholder="Your name or a nickname"
								autoComplete="off"
								onChange={(e) => setP("user_name", e.target.value)}
							/>
						</Field>
					</Card>

					<Card>
						<CardHead>
							<h2>Personality</h2>
							<p>
								Pick up to {PERSONA_LIMITS.traits}. {p.traits.length > 0 && `${p.traits.length} chosen.`}
							</p>
						</CardHead>
						<ChipWrap>
							{TRAITS.map((t) => {
								const on = p.traits.includes(t.id);
								return (
									<Chip
										key={t.id}
										type="button"
										aria-pressed={on}
										$on={on}
										$accent={accent}
										disabled={!on && p.traits.length >= PERSONA_LIMITS.traits}
										onClick={() => toggleTrait(t.id)}
									>
										{on && <Icon name="check" size={13} />}
										{t.label}
									</Chip>
								);
							})}
						</ChipWrap>
						<Scale title="Tone" labels={FORMALITY} value={p.formality} accent={accent} onChange={(v) => setP("formality", v)} />
						<Scale title="Humour" labels={HUMOR} value={p.humor} accent={accent} onChange={(v) => setP("humor", v)} />
						<Scale title="Replies" labels={LENGTHS} value={p.length} accent={accent} onChange={(v) => setP("length", v)} />
						<ToggleRow>
							<span>Uses emojis</span>
							<Switch
								type="button"
								role="switch"
								aria-checked={p.emoji}
								aria-label="Uses emojis"
								$on={p.emoji}
								$accent={accent}
								onClick={() => setP("emoji", !p.emoji)}
							/>
						</ToggleRow>
					</Card>

					<Card>
						<CardHead>
							<h2>Their story</h2>
							<p>Optional. A few sentences go a long way with small models.</p>
						</CardHead>
						<Field>
							<LabelRow>
								<Label htmlFor="friend-story">Backstory</Label>
								<Count $warn={p.backstory.length >= PERSONA_LIMITS.backstory}>
									{p.backstory.length}/{PERSONA_LIMITS.backstory}
								</Count>
							</LabelRow>
							<TextArea
								id="friend-story"
								value={p.backstory}
								maxLength={PERSONA_LIMITS.backstory}
								placeholder="Where they're from, what they do, what they love and can't stand."
								onChange={(e) => setP("backstory", e.target.value)}
							/>
						</Field>
						<Field>
							<LabelRow>
								<Label htmlFor="friend-style">How they talk</Label>
								<Count>
									{p.style.length}/{PERSONA_LIMITS.style}
								</Count>
							</LabelRow>
							<Input
								id="friend-style"
								value={p.style}
								maxLength={PERSONA_LIMITS.style}
								placeholder={'Catchphrases or habits, e.g. says "no way!" a lot'}
								autoComplete="off"
								onChange={(e) => setP("style", e.target.value)}
							/>
						</Field>
					</Card>

					<Card>
						<CardHead>
							<h2>What {name || "they"} should remember</h2>
							<p>Facts about you they keep in mind in every chat. They stay on this device.</p>
						</CardHead>
						{p.memories.length > 0 && (
							<MemoryList>
								{p.memories.map((m, i) => (
									<MemoryItem key={`${i}:${m}`}>
										<Icon name="emoji_objects" size={15} color={accent} />
										<span>{m}</span>
										<IconBtn
											type="button"
											aria-label={`Forget: ${m}`}
											title="Forget"
											onClick={() => setP("memories", p.memories.filter((_, j) => j !== i))}
										>
											<Icon name="close" size={15} />
										</IconBtn>
									</MemoryItem>
								))}
							</MemoryList>
						)}
						{p.memories.length < PERSONA_LIMITS.memories ? (
							<AddRow onSubmit={addMemory}>
								<Input
									value={memoryInput}
									maxLength={PERSONA_LIMITS.memory}
									placeholder="I work night shifts as a nurse"
									aria-label="Something to remember"
									autoComplete="off"
									enterKeyHint="done"
									onChange={(e) => setMemoryInput(e.target.value)}
								/>
								<SmallBtn type="submit" disabled={!memoryInput.trim()}>
									Add
								</SmallBtn>
							</AddRow>
						) : (
							<Hint>That's the most they can keep in mind at once.</Hint>
						)}
					</Card>

					<Card>
						<CardHead>
							<h2>First message</h2>
							<p>What they say when you open a new chat.</p>
						</CardHead>
						<Field>
							<LabelRow>
								<Label htmlFor="friend-greeting">Greeting</Label>
								<Count>
									{draft.greeting.length}/{LIMITS.greeting}
								</Count>
							</LabelRow>
							<TextArea
								id="friend-greeting"
								value={draft.greeting}
								maxLength={LIMITS.greeting}
								style={{ minHeight: 64 }}
								placeholder="Hey you! How's your day going?"
								onChange={(e) => set("greeting", e.target.value)}
							/>
						</Field>
					</Card>
				</Form>
			</Page>

			<Bar>
				<BarInner>
					{isEditing && (
						<DangerBtn type="button" onClick={remove} aria-label="Delete friend">
							<Icon name="delete" size={16} />
						</DangerBtn>
					)}
					<GhostBtn type="button" onClick={sayHi} disabled={!name}>
						<Icon name={testing ? "stop_circle" : "chat_bubble"} size={16} />
						{testing ? "Stop" : "Say hi"}
					</GhostBtn>
					<BarSpacer />
					<SaveBtn type="button" onClick={save} disabled={!canSave}>
						<Icon name="check" size={16} />
						{saving ? "Saving…" : isEditing ? "Save" : "Create friend"}
					</SaveBtn>
				</BarInner>
			</Bar>
		</AppLayout>
	);
}
