import { CharacterPicker } from "@/components/character/CharacterPicker";
import { AppLayout } from "@/components/layout/AppLayout";
import { Icon } from "@/components/ui/Icon";
import { ChatScene } from "@/components/ui/Illustrations";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { useToast } from "@/components/ui/Toast";
import { useAppContext } from "@/context/AppContext";
import { useCharacters } from "@/context/CharacterContext";
import { chatService, historyService, modelService } from "@/services";
import type { InferenceEvent } from "@/services/types";
import { alpha } from "@/theme/alpha";
import { tokens } from "@/theme/tokens";
import { accentOf } from "@/utils/characterAccent";
import { cleanResponse } from "@/utils/cleanResponse";
import { copyText, isTouchPrimary, vibrate } from "@/utils/platform";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import styled, { keyframes } from "styled-components";
import { Markdown } from "./chat/Markdown";
import {
	type Message,
	buildHistory,
	createMessage,
	cutShortLabel,
	fromStored,
	persistable,
	toConversation,
	wasCutShort,
} from "./chat/messages";

// Soft cap on prompt length. Models choke well before this; it mainly guards
// against an accidental paste of a huge file. Enforced by the textarea.
const MAX_PROMPT_LENGTH = 16_000;
const DRAFT_KEY = "neurix.chat.draft";
const COACH_KEY = "neurix.coach.subtitle.v2";
/** How close to the bottom (px) still counts as "following" the stream. */
const FOLLOW_THRESHOLD = 96;

/* ── Animations ── */

const dotPulse = keyframes`
  0%, 100% { opacity: 0.3; transform: translateY(0); }
  50% { opacity: 1; transform: translateY(-4px); }
`;

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
`;

/* ── Layout ── */

const ChatContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
`;

const MessagesArea = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1rem 1rem 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
  max-width: 52rem;
  margin: 0 auto;

  &::-webkit-scrollbar { width: 0; }
  scrollbar-width: none;
`;

const BubbleWrap = styled.div<{ $role: Message["role"] }>`
  display: flex;
  flex-direction: column;
  align-items: ${({ $role }) => ($role === "user" ? "flex-end" : "flex-start")};
  animation: ${fadeInUp} 0.25s ease-out both;
`;

const Bubble = styled.div<{ $role: Message["role"] }>`
  max-width: min(85%, 44rem);
  padding: 0.75rem 1rem;
  border-radius: 18px;
  font-size: ${tokens.typography.fontSize.base};
  line-height: ${tokens.typography.lineHeight.relaxed};

  ${({ $role }) =>
		$role === "user"
			? `
    background: ${alpha(tokens.colors.primary, "1f")};
    border: 1px solid ${alpha(tokens.colors.primary, "33")};
    color: ${tokens.colors.onSurface};
    border-bottom-right-radius: 4px;
  `
			: $role === "error"
				? `
    background: ${alpha(tokens.colors.error, "14")};
    border: 1px solid ${alpha(tokens.colors.error, "40")};
    color: ${tokens.colors.onSurface};
    border-bottom-left-radius: 4px;
  `
				: `
    background: ${tokens.colors.surfaceContainerHigh};
    border: 1px solid ${alpha(tokens.colors.outlineVariant, "4d")};
    color: ${tokens.colors.onSurfaceVariant};
    border-bottom-left-radius: 4px;
  `}
`;

const BubbleLabel = styled.span<{ $color: string }>`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: ${tokens.typography.fontSize.xs};
  font-weight: ${tokens.typography.fontWeight.semibold};
  letter-spacing: ${tokens.typography.letterSpacing.wide};
  margin-bottom: 0.25rem;
  color: ${({ $color }) => $color};
`;

const BubbleBody = styled.div`
  word-break: break-word;
  user-select: text;
  -webkit-user-select: text;
`;

const UserText = styled.div`
  white-space: pre-wrap;
`;

/* ── Message actions ──
   Pointer devices: the row always occupies its space (no layout shift) and
   fades in on hover or keyboard focus. Touch devices: collapsed until the
   bubble is long-pressed. */

const MessageActions = styled.div<{ $open: boolean }>`
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-top: 0.25rem;
  transition: opacity ${tokens.transitions.fast};

  @media (hover: hover) {
    opacity: ${({ $open }) => ($open ? 1 : 0)};
    ${BubbleWrap}:hover &,
    ${BubbleWrap}:focus-within & { opacity: 1; }
  }

  @media (hover: none) {
    display: ${({ $open }) => ($open ? "flex" : "none")};
  }
`;

const MsgActionBtn = styled.button<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  min-height: 32px;
  padding: 0.375rem 0.625rem;
  background: ${({ $active }) =>
		$active ? alpha(tokens.colors.secondary, "1f") : tokens.colors.surfaceContainerHigh};
  border: none;
  border-radius: ${tokens.borderRadius.lg};
  cursor: pointer;
  font-size: ${tokens.typography.fontSize.xs};
  font-weight: ${tokens.typography.fontWeight.medium};
  color: ${({ $active }) => ($active ? tokens.colors.secondary : tokens.colors.onSurfaceVariant)};
  transition: background ${tokens.transitions.fast}, transform ${tokens.transitions.fast};

  &:hover { background: ${tokens.colors.surfaceContainerHighest}; color: ${tokens.colors.onSurface}; }
  &:active { transform: scale(0.94); }

  @media (hover: none) { min-height: 40px; padding: 0.5rem 0.75rem; }
`;

const CutShort = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.375rem;
  font-size: ${tokens.typography.fontSize.xs};
  color: ${tokens.colors.onSurfaceVariant};
`;

const ContinueBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  min-height: 32px;
  padding: 0.25rem 0.75rem;
  border-radius: ${tokens.borderRadius.circle};
  border: 1px solid ${alpha(tokens.colors.primary, "66")};
  background: ${alpha(tokens.colors.primary, "14")};
  color: ${tokens.colors.primary};
  font-size: ${tokens.typography.fontSize.xs};
  font-weight: ${tokens.typography.fontWeight.semibold};
  cursor: pointer;

  &:hover { background: ${alpha(tokens.colors.primary, "26")}; }
  &:active { transform: scale(0.96); }
`;

const TypingDots = styled.div`
  display: flex;
  gap: 4px;
  padding: 0.375rem 0;

  span {
    width: 6px;
    height: 6px;
    border-radius: ${tokens.borderRadius.circle};
    background: ${tokens.colors.primary};
    animation: ${dotPulse} 1.2s ease-in-out infinite;

    &:nth-child(2) { animation-delay: 0.2s; }
    &:nth-child(3) { animation-delay: 0.4s; }
  }
`;

const SpeedBadge = styled.span`
  font-size: 10px;
  font-family: ${tokens.typography.fontFamily.mono};
  color: ${tokens.colors.onSurfaceVariant};
  padding: 0.125rem 0.375rem;
  background: ${tokens.colors.surfaceContainerHighest};
  border-radius: ${tokens.borderRadius.md};
  margin-top: 0.375rem;
  display: inline-block;
`;

const ContextNotice = styled.div`
  align-self: center;
  font-size: ${tokens.typography.fontSize.xs};
  color: ${tokens.colors.onSurfaceVariant};
  background: ${tokens.colors.surfaceContainerHigh};
  padding: 0.375rem 0.75rem;
  border-radius: ${tokens.borderRadius.circle};
  display: flex;
  align-items: center;
  gap: 0.375rem;
  animation: ${fadeInUp} 0.25s ease-out both;
`;

const JumpBtn = styled.button`
  position: absolute;
  left: 50%;
  bottom: 4.75rem;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.875rem;
  border-radius: ${tokens.borderRadius.circle};
  border: 1px solid ${tokens.colors.outlineVariant};
  background: ${tokens.colors.surfaceContainerHighest};
  color: ${tokens.colors.onSurface};
  font-size: ${tokens.typography.fontSize.xs};
  font-weight: ${tokens.typography.fontWeight.semibold};
  box-shadow: ${tokens.shadows.elevated};
  cursor: pointer;
  z-index: ${tokens.zIndex.content};
`;

/* ── Empty state ── */

const Welcome = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 1rem 0.5rem 1.5rem;
  text-align: center;
  animation: ${fadeInUp} 0.3s ease-out both;
`;

const WelcomeTitle = styled.h2`
  font-family: ${tokens.typography.fontFamily.headline};
  font-size: ${tokens.typography.fontSize.xl};
  font-weight: ${tokens.typography.fontWeight.bold};
  color: ${tokens.colors.onSurface};
`;

const WelcomeText = styled.p`
  font-size: ${tokens.typography.fontSize.base};
  color: ${tokens.colors.onSurfaceVariant};
  max-width: 20rem;
  line-height: ${tokens.typography.lineHeight.relaxed};
`;

const StartersGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.5rem;
  width: 100%;
  max-width: 34rem;
  margin-top: 0.5rem;

  @media (min-width: 560px) { grid-template-columns: 1fr 1fr; }
`;

const StarterChip = styled.button<{ $accent: string }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 0.875rem;
  background: ${tokens.colors.surfaceContainerHigh};
  border: 1px solid ${alpha(tokens.colors.outlineVariant, "66")};
  border-radius: ${tokens.borderRadius.xl};
  color: ${tokens.colors.onSurface};
  font-size: ${tokens.typography.fontSize.sm};
  font-family: ${tokens.typography.fontFamily.body};
  text-align: left;
  cursor: pointer;
  transition: transform ${tokens.transitions.fast}, border-color ${tokens.transitions.fast};

  &:hover { border-color: ${({ $accent }) => alpha($accent, "99")}; transform: translateY(-1px); }
  &:active { transform: scale(0.98); }

  svg { margin-left: auto; color: ${({ $accent }) => $accent}; }
`;

const PrimaryCta = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  border-radius: ${tokens.borderRadius.xl};
  background: linear-gradient(135deg, ${tokens.colors.primary}, ${tokens.colors.primaryContainer});
  color: ${tokens.colors.onPrimaryFixed};
  font-size: ${tokens.typography.fontSize.sm};
  font-weight: ${tokens.typography.fontWeight.bold};
  border: none;
  cursor: pointer;

  &:active { transform: scale(0.96); }
`;

const SecondaryCta = styled.button`
  padding: 0.75rem 1.25rem;
  border-radius: ${tokens.borderRadius.xl};
  background: transparent;
  color: ${tokens.colors.onSurface};
  font-size: ${tokens.typography.fontSize.sm};
  font-weight: ${tokens.typography.fontWeight.medium};
  border: 1px solid ${tokens.colors.outlineVariant};
  cursor: pointer;

  &:active { transform: scale(0.96); }
`;

/* ── Input bar ── */

const InputBar = styled.div`
  flex-shrink: 0;
  background: ${tokens.colors.surfaceContainer};
  border-top: 1px solid ${alpha(tokens.colors.outlineVariant, "4d")};
`;

const InputRow = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem 0.625rem;
  max-width: 52rem;
  margin: 0 auto;
  position: relative;
`;

const CharCounter = styled.span<{ $over: boolean }>`
  position: absolute;
  top: -1.25rem;
  right: 0.75rem;
  font-size: 11px;
  font-family: ${tokens.typography.fontFamily.mono};
  color: ${({ $over }) => ($over ? tokens.colors.error : tokens.colors.onSurfaceVariant)};
  background: ${tokens.colors.surfaceContainer};
  padding: 0.125rem 0.375rem;
  border-radius: ${tokens.borderRadius.md};
  pointer-events: none;
`;

const TextInput = styled.textarea`
  flex: 1;
  min-height: 42px;
  max-height: 140px;
  padding: 0.625rem 0.875rem;
  background: ${tokens.colors.surfaceContainerHigh};
  border: 1px solid ${alpha(tokens.colors.outlineVariant, "66")};
  border-radius: 21px;
  font-size: ${tokens.typography.fontSize.base};
  font-family: ${tokens.typography.fontFamily.body};
  color: ${tokens.colors.onSurface};
  resize: none;
  outline: none;
  line-height: 1.4;
  /* Android WebView reserves a scrollbar gutter on textarea even when
     content fits. Hide the visual; the textarea stays scrollable. */
  &::-webkit-scrollbar { width: 0; height: 0; }
  scrollbar-width: none;

  &::placeholder { color: ${tokens.colors.outline}; }
  &:focus { border-color: ${tokens.colors.primary}; }
`;

const RoundBtn = styled.button<{ $variant: "send" | "idle" | "stop" }>`
  width: 42px;
  height: 42px;
  border-radius: 21px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: transform ${tokens.transitions.fast}, opacity ${tokens.transitions.fast};

  ${({ $variant }) =>
		$variant === "send"
			? `border: none; color: ${tokens.colors.onPrimaryFixed};
         background: linear-gradient(135deg, ${tokens.colors.primary}, ${tokens.colors.primaryContainer});`
			: $variant === "stop"
				? `border: 1.5px solid ${alpha(tokens.colors.error, "99")}; color: ${tokens.colors.error};
           background: ${alpha(tokens.colors.error, "1f")};`
				: `border: 1px solid ${alpha(tokens.colors.outlineVariant, "66")};
           color: ${tokens.colors.onSurfaceVariant}; background: ${tokens.colors.surfaceContainerHigh};`}

  &:disabled { cursor: default; opacity: 0.6; }
  &:not(:disabled):active { transform: scale(0.9); }
`;

/* ── Top bar ── */

const TopBarBtn = styled.button`
  width: 40px;
  height: 40px;
  border-radius: ${tokens.borderRadius.xl};
  border: none;
  background: transparent;
  color: ${tokens.colors.onSurfaceVariant};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background ${tokens.transitions.fast};

  &:hover { background: ${tokens.colors.surfaceContainerHigh}; color: ${tokens.colors.onSurface}; }
  &:active { transform: scale(0.9); }
`;

/* Header pill (character + model): the primary identity element for the
   chat page. One tap target that opens the character and model switcher. */

const HeaderPill = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.375rem 0.5rem 0.375rem 0.375rem;
  background: transparent;
  border: none;
  border-radius: ${tokens.borderRadius.xl};
  color: ${tokens.colors.onSurface};
  cursor: pointer;
  transition: background ${tokens.transitions.fast};
  max-width: 100%;
  min-width: 0;
  text-align: left;

  &:hover { background: ${tokens.colors.surfaceContainerHigh}; }
  &:active { background: ${tokens.colors.surfaceContainerHighest}; }
`;

const HeaderAvatar = styled.span<{ $accent: string }>`
  width: 34px;
  height: 34px;
  border-radius: ${tokens.borderRadius.circle};
  background: ${({ $accent }) => alpha($accent, "1f")};
  border: 1px solid ${({ $accent }) => alpha($accent, "55")};
  color: ${({ $accent }) => $accent};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

const HeaderTextStack = styled.span`
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 1px;
`;

const HeaderCharName = styled.span`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-family: ${tokens.typography.fontFamily.headline};
  font-size: ${tokens.typography.fontSize.base};
  font-weight: ${tokens.typography.fontWeight.bold};
  line-height: 1.1;
  min-width: 0;

  > span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 9rem;
  }
`;

const HeaderModelLine = styled.span`
  font-size: 11px;
  font-weight: ${tokens.typography.fontWeight.medium};
  color: ${tokens.colors.onSurfaceVariant};
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 14rem;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
`;

const ModelDot = styled.span<{ $on: boolean }>`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  background: ${({ $on }) => ($on ? tokens.colors.secondary : tokens.colors.outline)};
  box-shadow: ${({ $on }) => ($on ? `0 0 6px ${alpha(tokens.colors.secondary, "80")}` : "none")};
`;

/* First-run coachmark so the switcher doesn't go undiscovered. */

const coachIn = keyframes`
  from { opacity: 0; transform: translate(-50%, -4px); }
  to { opacity: 1; transform: translate(-50%, 0); }
`;

const Coachmark = styled.div`
  position: fixed;
  top: calc(env(safe-area-inset-top, 0px) + 64px);
  left: 50%;
  transform: translateX(-50%);
  z-index: ${tokens.zIndex.overlay};
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.875rem;
  background: ${tokens.colors.surfaceContainerHighest};
  color: ${tokens.colors.onSurface};
  border: 1px solid ${alpha(tokens.colors.primary, "66")};
  border-radius: ${tokens.borderRadius.xl};
  font-size: ${tokens.typography.fontSize.xs};
  box-shadow: ${tokens.shadows.elevated};
  animation: ${coachIn} 0.25s ease-out;
  max-width: calc(100vw - 2rem);
`;

const CoachClose = styled.button`
  border: none;
  background: transparent;
  color: ${tokens.colors.onSurfaceVariant};
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 0.25rem;
`;

/* ── Small pieces ── */

function CopyAction({ text }: { text: string }) {
	const [copied, setCopied] = useState(false);
	const { showToast } = useToast();

	const handleCopy = async () => {
		if (await copyText(text)) {
			vibrate(5);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} else {
			showToast("Couldn't copy to the clipboard", "error");
		}
	};

	return (
		<MsgActionBtn type="button" onClick={handleCopy} $active={copied}>
			<Icon name={copied ? "check" : "content_copy"} size={14} />
			{copied ? "Copied" : "Copy"}
		</MsgActionBtn>
	);
}

function readDraft(): string {
	try {
		return localStorage.getItem(DRAFT_KEY) ?? "";
	} catch {
		return "";
	}
}

function writeDraft(text: string) {
	try {
		if (text) localStorage.setItem(DRAFT_KEY, text);
		else localStorage.removeItem(DRAFT_KEY);
	} catch {
		// Storage unavailable: the draft just won't survive leaving the page.
	}
}

type LoadProblem = { kind: "failed"; message: string } | { kind: "no-models" };

interface RunOptions {
	prompt: string;
	/** Conversation up to, but not including, the prompt being answered. */
	context: Message[];
	/** Existing reply text to extend (the "Continue" action). */
	prefix?: string;
}

/* ── Component ── */

export function ChatPage() {
	const navigate = useNavigate();
	const location = useLocation();
	const { activeModel, activeModelId, settings, loadModel } = useAppContext();
	const { activeCharacter, allCharacters, setActiveCharacter, loaded: charactersLoaded } = useCharacters();
	const { showToast } = useToast();

	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput] = useState(readDraft);
	const [isGenerating, setIsGenerating] = useState(false);
	const [isLoadingModel, setIsLoadingModel] = useState(false);
	const [loadProblem, setLoadProblem] = useState<LoadProblem | null>(null);
	const [pickerOpen, setPickerOpen] = useState(false);
	const [showCoach, setShowCoach] = useState(false);
	const [streamedText, setStreamedText] = useState("");
	const [tokensPerSecond, setTokensPerSecond] = useState(0);
	const [openActionsId, setOpenActionsId] = useState<string | null>(null);
	const [contextNotice, setContextNotice] = useState<string | null>(null);
	const [following, setFollowing] = useState(true);

	const scrollRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const followingRef = useRef(true);

	// Long-lived callbacks (inference events, unmount cleanup) outlive the
	// render that created them. Everything they need is read through this
	// ref so they always see current values instead of a stale snapshot.
	const live = useRef({
		messages,
		conversationId: null as string | null,
		activeModel,
		activeModelId,
		saveHistory: settings?.save_history ?? false,
		character: activeCharacter,
		isGenerating,
	});
	live.current.activeModel = activeModel;
	live.current.activeModelId = activeModelId;
	live.current.saveHistory = settings?.save_history ?? false;
	live.current.character = activeCharacter;

	// Identifies the current generation. Events from an older run (one that
	// was stopped by "New chat", or superseded) are ignored.
	const runIdRef = useRef(0);
	// Tokens arrive faster than the screen refreshes; they are buffered here
	// and flushed to state once per animation frame.
	const streamRef = useRef({ text: "", prefix: "", frame: 0 });

	const characterName = activeCharacter?.name ?? "Neurix";
	const accent = accentOf(activeCharacter);

	/* ── Persistence ── */

	const persist = useCallback((msgs: Message[]) => {
		const s = live.current;
		const toSave = persistable(msgs);
		if (!s.saveHistory || toSave.length < 2 || !s.activeModelId || !s.activeModel) return;
		if (!s.conversationId) s.conversationId = crypto.randomUUID();
		historyService
			.saveConversation(
				toConversation(toSave, {
					id: s.conversationId,
					modelId: s.activeModelId,
					modelName: s.activeModel,
					characterId: s.character?.id,
					characterName: s.character?.name,
				}),
			)
			.catch(() => {
				showToast("Couldn't save this conversation", "error");
			});
	}, [showToast]);

	/** Update the visible list (and the copy long-lived callbacks read). */
	const show = useCallback((next: Message[]) => {
		live.current.messages = next;
		setMessages(next);
	}, []);

	/** Update the list and save it. */
	const commit = useCallback((next: Message[]) => {
		show(next);
		persist(next);
	}, [show, persist]);

	const setGenerating = useCallback((value: boolean) => {
		live.current.isGenerating = value;
		setIsGenerating(value);
	}, []);

	/* ── Scrolling ── */

	const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
		const el = scrollRef.current;
		if (el) el.scrollTo({ top: el.scrollHeight, behavior });
	}, []);

	const handleScroll = () => {
		const el = scrollRef.current;
		if (!el) return;
		const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < FOLLOW_THRESHOLD;
		followingRef.current = atBottom;
		setFollowing(atBottom);
	};

	// Follow new content only while the reader is already at the bottom, so
	// scrolling up to re-read is never yanked back down by the stream.
	// biome-ignore lint/correctness/useExhaustiveDependencies: must re-run whenever the rendered content grows
	useEffect(() => {
		if (followingRef.current) scrollToBottom();
	}, [messages.length, streamedText, isGenerating, scrollToBottom]);

	// Keep the latest message visible when the on-screen keyboard opens.
	useEffect(() => {
		const vv = window.visualViewport;
		if (!vv) return;
		const onResize = () => {
			if (followingRef.current) scrollToBottom();
		};
		vv.addEventListener("resize", onResize);
		return () => vv.removeEventListener("resize", onResize);
	}, [scrollToBottom]);

	const autoResize = useCallback(() => {
		const el = textareaRef.current;
		if (!el) return;
		el.style.height = "auto";
		el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
	}, []);

	// Size the box for a restored draft.
	useEffect(() => {
		autoResize();
	}, [autoResize]);

	/* ── First-run coachmark ── */

	useEffect(() => {
		try {
			if (localStorage.getItem(COACH_KEY)) return;
		} catch {
			return;
		}
		const t = setTimeout(() => setShowCoach(true), 800);
		return () => clearTimeout(t);
	}, []);

	const dismissCoach = useCallback(() => {
		setShowCoach(false);
		try {
			localStorage.setItem(COACH_KEY, new Date().toISOString());
		} catch {
			// Not persisted: the tip shows again next launch, which is harmless.
		}
	}, []);

	useEffect(() => {
		if (!showCoach) return;
		const t = setTimeout(dismissCoach, 6000);
		return () => clearTimeout(t);
	}, [showCoach, dismissCoach]);

	/* ── Character change notice ── */

	const lastCharIdRef = useRef<string | null>(null);
	const suppressCharToastRef = useRef(false);
	useEffect(() => {
		const prev = lastCharIdRef.current;
		const next = activeCharacter?.id ?? null;
		lastCharIdRef.current = next;
		if (suppressCharToastRef.current) {
			suppressCharToastRef.current = false;
			return;
		}
		if (prev && next && prev !== next && live.current.messages.length > 0) {
			showToast(`Now using ${activeCharacter?.name}. The next reply will use this style.`, "info");
		}
	}, [activeCharacter?.id, activeCharacter?.name, showToast]);

	/* ── Loading a conversation ── */

	const openedRef = useRef(false);
	useEffect(() => {
		// Wait for characters so a conversation's character can be restored.
		if (openedRef.current || !charactersLoaded) return;
		openedRef.current = true;

		const state = location.state as { conversationId?: string; freshChat?: boolean } | null;
		if (state?.freshChat) return;

		(async () => {
			try {
				// Open the requested conversation, or pick up the most recent one.
				const id = state?.conversationId ?? (await historyService.getConversations())[0]?.id;
				if (!id) return;
				const conv = await historyService.loadConversation(id);
				// Don't overwrite a conversation the user already started here.
				if (!conv || live.current.messages.length > 0) return;

				live.current.conversationId = conv.id;
				show(fromStored(conv.messages));

				// A conversation continues with the character it was held with.
				const convCharacter = conv.character_id;
				if (
					convCharacter &&
					convCharacter !== live.current.character?.id &&
					allCharacters.some((c) => c.id === convCharacter)
				) {
					suppressCharToastRef.current = true;
					await setActiveCharacter(convCharacter).catch(() => {
						suppressCharToastRef.current = false;
					});
				}
			} catch {
				if (state?.conversationId) showToast("Couldn't open that conversation", "error");
			}
		})();
	}, [charactersLoaded, location.state, allCharacters, setActiveCharacter, showToast, show]);

	/* ── Inference ── */

	const flushStream = useCallback(() => {
		const s = streamRef.current;
		s.frame = 0;
		setStreamedText(s.prefix + s.text);
	}, []);

	const resetStream = useCallback(() => {
		if (streamRef.current.frame) cancelAnimationFrame(streamRef.current.frame);
		streamRef.current = { text: "", prefix: "", frame: 0 };
		setStreamedText("");
	}, []);

	const run = useCallback(async ({ prompt, context, prefix = "" }: RunOptions) => {
		const character = live.current.character;
		const runId = ++runIdRef.current;
		const isCurrent = () => runIdRef.current === runId;

		resetStream();
		streamRef.current.prefix = prefix;
		if (prefix) setStreamedText(prefix);
		setGenerating(true);
		setTokensPerSecond(0);
		followingRef.current = true;
		setFollowing(true);

		const finish = (extra: Message[]) => {
			resetStream();
			setGenerating(false);
			if (extra.length > 0) commit([...live.current.messages, ...extra]);
		};

		const handleEvent = (event: InferenceEvent) => {
			if (!isCurrent()) return;
			switch (event.event) {
				case "TokenGenerated": {
					const s = streamRef.current;
					s.text += event.data.token;
					if (!s.frame) s.frame = requestAnimationFrame(flushStream);
					setTokensPerSecond(event.data.tokens_per_second);
					break;
				}
				case "GenerationComplete": {
					const { total_tokens, duration_ms, stop_reason } = event.data;
					const cleaned = cleanResponse(streamRef.current.prefix + streamRef.current.text);
					if (duration_ms > 0) setTokensPerSecond(total_tokens / (duration_ms / 1000));
					finish(cleaned ? [createMessage("ai", cleaned, { stopReason: stop_reason })] : []);
					break;
				}
				case "ContextTrimmed": {
					const n = event.data.pairs_dropped;
					setContextNotice(
						`Long chat: the ${n} oldest exchange${n === 1 ? "" : "s"} no longer fit in the model's memory.`,
					);
					setTimeout(() => setContextNotice(null), 5000);
					break;
				}
				case "Error":
					finish([createMessage("error", event.data.message)]);
					break;
			}
		};

		try {
			await chatService.runInference(
				{
					prompt,
					systemPrompt: character?.system_prompt ?? settings?.system_prompt ?? "",
					history: buildHistory(context),
					temperature: character?.temperature ?? settings?.temperature ?? 0.7,
					topP: character?.top_p ?? settings?.top_p ?? 0.9,
					maxTokens: character?.max_tokens ?? settings?.max_tokens ?? 512,
					assistantPrefix: prefix || undefined,
				},
				handleEvent,
			);
		} catch (err) {
			if (!isCurrent()) return;
			// Keep whatever had streamed before the failure.
			const partial = cleanResponse(streamRef.current.prefix + streamRef.current.text);
			const message = err instanceof Error ? err.message : String(err);
			finish([
				...(partial ? [createMessage("ai", partial)] : []),
				createMessage("error", message),
			]);
		}
	}, [commit, flushStream, resetStream, setGenerating, settings?.system_prompt, settings?.temperature, settings?.top_p, settings?.max_tokens]);

	/** Make sure a model is loaded, loading the last-used one if needed. */
	const ensureModel = useCallback(async (): Promise<boolean> => {
		if (live.current.activeModelId) return true;
		setLoadProblem(null);
		setIsLoadingModel(true);
		try {
			const installed = await modelService.getDownloadedModels();
			if (installed.length === 0) {
				setLoadProblem({ kind: "no-models" });
				return false;
			}
			const preferred = installed.find((m) => m.id === settings?.last_model_id) ?? installed[0];
			await loadModel(preferred.id);
			live.current.activeModelId = preferred.id;
			live.current.activeModel = preferred.name;
			return true;
		} catch (err) {
			setLoadProblem({ kind: "failed", message: err instanceof Error ? err.message : String(err) });
			return false;
		} finally {
			setIsLoadingModel(false);
		}
	}, [loadModel, settings?.last_model_id]);

	const sendingRef = useRef(false);

	const handleSend = async () => {
		const text = input.trim();
		if (!text || isGenerating || isLoadingModel || sendingRef.current) return;
		sendingRef.current = true;
		try {
			vibrate(10);
			// On failure the typed message stays in the box and the reason is
			// shown in place, with a retry.
			if (!(await ensureModel())) return;

			const context = live.current.messages;
			show([...context, createMessage("user", text)]);
			setInput("");
			writeDraft("");
			setOpenActionsId(null);
			if (textareaRef.current) textareaRef.current.style.height = "auto";

			await run({ prompt: text, context });
		} finally {
			sendingRef.current = false;
		}
	};

	const handleStop = () => {
		vibrate(12);
		chatService.stopInference().catch(() => {});
	};

	/** The last AI reply and the user message it answers, if the chat ends with one. */
	const lastExchange = () => {
		const msgs = live.current.messages;
		const aiIdx = msgs.length - 1;
		if (aiIdx < 1 || msgs[aiIdx].role !== "ai") return null;
		for (let i = aiIdx - 1; i >= 0; i--) {
			if (msgs[i].role === "user") return { msgs, userIdx: i, aiIdx };
		}
		return null;
	};

	/** Re-answer the last prompt; with `extend`, keep the reply and continue it. */
	const redoLast = async (extend: boolean) => {
		if (isGenerating) return;
		const ex = lastExchange();
		if (!ex || !(await ensureModel())) return;
		const { msgs, userIdx, aiIdx } = ex;
		show(msgs.slice(0, aiIdx));
		setOpenActionsId(null);
		await run({
			prompt: msgs[userIdx].text,
			context: msgs.slice(0, userIdx),
			prefix: extend ? msgs[aiIdx].text : undefined,
		});
	};

	const handleDeleteMessage = (id: string) => {
		const before = live.current.messages;
		const target = before.find((m) => m.id === id);
		commit(before.filter((m) => m.id !== id));
		setOpenActionsId(null);
		if (target && target.role !== "error") {
			showToast("Message deleted", "info", { label: "Undo", onAction: () => commit(before) });
		}
	};

	/**
	 * Edit-and-resend a user message: drops it and everything after it, and
	 * puts its text back in the input. Editing a turn invalidates every
	 * reply that depended on it.
	 */
	const handleEditMessage = (id: string) => {
		if (isGenerating) return;
		const msgs = live.current.messages;
		const idx = msgs.findIndex((m) => m.id === id);
		if (idx < 0 || msgs[idx].role !== "user") return;
		setOpenActionsId(null);
		commit(msgs.slice(0, idx));
		fillInput(msgs[idx].text);
	};

	const handleShareChat = async () => {
		const text = persistable(messages)
			.map((m) => `${m.role === "user" ? "You" : characterName}: ${m.text}`)
			.join("\n\n");
		if (!text) return;

		if (navigator.share) {
			try {
				await navigator.share({ title: "Neurix chat", text });
				return;
			} catch (err) {
				// Dismissing the share sheet is not an error worth a fallback.
				if (err instanceof Error && err.name === "AbortError") return;
			}
		}
		if (await copyText(text)) showToast("Conversation copied to the clipboard", "success");
		else showToast("Couldn't copy the conversation", "error");
	};

	const handleNewChat = () => {
		// Invalidate the running generation first so its completion event
		// cannot land in the new, empty conversation.
		runIdRef.current += 1;
		if (isGenerating) chatService.stopInference().catch(() => {});
		resetStream();
		setGenerating(false);
		live.current.conversationId = null;
		show([]);
		setOpenActionsId(null);
		setContextNotice(null);
		textareaRef.current?.focus();
	};

	// Leaving mid-generation: stop the model and keep what it wrote so far
	// in the same conversation (if history is on).
	useEffect(() => {
		return () => {
			if (!live.current.isGenerating) return;
			runIdRef.current += 1;
			chatService.stopInference().catch(() => {});
			const s = streamRef.current;
			const partial = cleanResponse(s.prefix + s.text);
			if (partial) persist([...live.current.messages, createMessage("ai", partial)]);
		};
	}, [persist]);

	/* ── Input handling ── */

	const handleKeyDown = (e: React.KeyboardEvent) => {
		// With a hardware keyboard, Enter sends and Shift+Enter breaks the
		// line. On touch keyboards Enter is the only way to add a line, so it
		// inserts one and the send button sends.
		if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !isTouchPrimary()) {
			e.preventDefault();
			handleSend();
		}
	};

	const handleLongPressStart = (id: string) => {
		longPressRef.current = setTimeout(() => {
			vibrate(15);
			setOpenActionsId((prev) => (prev === id ? null : id));
		}, 400);
	};

	const handleLongPressEnd = () => {
		if (longPressRef.current) {
			clearTimeout(longPressRef.current);
			longPressRef.current = null;
		}
	};

	const fillInput = (text: string) => {
		setInput(text);
		writeDraft(text);
		requestAnimationFrame(() => {
			textareaRef.current?.focus();
			autoResize();
		});
	};

	const lastId = messages[messages.length - 1]?.id;
	const hasText = input.trim().length > 0;
	const showStream = isGenerating || streamedText.length > 0;
	const starters = activeCharacter?.conversation_starters?.slice(0, 4) ?? [];

	return (
		<>
			{isLoadingModel && (
				<LoadingOverlay title="Loading model" subtitle="This can take a few seconds…" />
			)}
			{!isLoadingModel && loadProblem?.kind === "failed" && (
				<LoadingOverlay
					title="Couldn't load the model"
					subtitle={loadProblem.message}
					icon={<Icon name="error_outline" size={40} color={tokens.colors.error} />}
				>
					<PrimaryCta
						type="button"
						onClick={() => {
							setLoadProblem(null);
							handleSend();
						}}
					>
						<Icon name="refresh" size={16} />
						Try again
					</PrimaryCta>
					<SecondaryCta type="button" onClick={() => navigate("/models")}>
						Choose another model
					</SecondaryCta>
					<SecondaryCta type="button" onClick={() => setLoadProblem(null)}>
						Dismiss
					</SecondaryCta>
				</LoadingOverlay>
			)}
			{!isLoadingModel && loadProblem?.kind === "no-models" && (
				<LoadingOverlay
					title="No model installed yet"
					subtitle="Neurix needs a model on this device to reply. Your message is kept — download a model and come back."
					icon={<Icon name="deployed_code" size={40} color={tokens.colors.primary} />}
				>
					<PrimaryCta type="button" onClick={() => navigate("/store")}>
						<Icon name="download" size={16} />
						Browse models
					</PrimaryCta>
					<SecondaryCta type="button" onClick={() => setLoadProblem(null)}>
						Not now
					</SecondaryCta>
				</LoadingOverlay>
			)}

			<AppLayout
				hideLogo
				subtitle={
					<HeaderPill
						type="button"
						onClick={() => {
							dismissCoach();
							setPickerOpen(true);
						}}
						aria-label={`Character: ${characterName}. Model: ${activeModel ?? "none loaded"}. Change character or model.`}
					>
						<HeaderAvatar $accent={accent}>
							<Icon name={activeCharacter?.icon || "auto_awesome"} size={17} />
						</HeaderAvatar>
						<HeaderTextStack>
							<HeaderCharName>
								<span>{characterName}</span>
								<Icon name="expand_more" size={14} color={tokens.colors.onSurfaceVariant} />
							</HeaderCharName>
							<HeaderModelLine>
								<ModelDot $on={!!activeModel && !isLoadingModel} />
								{isLoadingModel ? "Loading model…" : (activeModel ?? "No model loaded")}
							</HeaderModelLine>
						</HeaderTextStack>
					</HeaderPill>
				}
				rightActions={
					<>
						{messages.length > 0 && (
							<TopBarBtn type="button" onClick={handleShareChat} aria-label="Share chat">
								<Icon name="share" size={18} />
							</TopBarBtn>
						)}
						<TopBarBtn type="button" onClick={handleNewChat} aria-label="New chat">
							<Icon name="edit_square" size={18} />
						</TopBarBtn>
						<TopBarBtn type="button" onClick={() => navigate("/chat/history")} aria-label="Chat history">
							<Icon name="history" size={18} />
						</TopBarBtn>
					</>
				}
			>
				<ChatContainer>
					<MessagesArea ref={scrollRef} onScroll={handleScroll}>
						{messages.length === 0 && !showStream && (
							<Welcome>
								<ChatScene accent={accent} icon={activeCharacter?.icon ?? "auto_awesome"} />
								<WelcomeTitle>{activeCharacter?.greeting || `Chat with ${characterName}`}</WelcomeTitle>
								<WelcomeText>
									{activeCharacter?.description
										? `${activeCharacter.description}. Everything stays on this device.`
										: "Ask anything. Everything stays on this device."}
								</WelcomeText>
								{starters.length > 0 && (
									<StartersGrid>
										{starters.map((starter) => (
											<StarterChip
												key={starter}
												type="button"
												$accent={accent}
												onClick={() => fillInput(starter)}
											>
												<span>{starter}</span>
												<Icon name="arrow_outward" size={14} />
											</StarterChip>
										))}
									</StartersGrid>
								)}
							</Welcome>
						)}

						{contextNotice && (
							<ContextNotice role="status">
								<Icon name="info" size={14} />
								{contextNotice}
							</ContextNotice>
						)}

						{messages.map((msg) => {
							const isLast = msg.id === lastId;
							const labelColor =
								msg.role === "ai"
									? accent
									: msg.role === "error"
										? tokens.colors.error
										: tokens.colors.onSurfaceVariant;
							const label =
								msg.role === "ai" ? characterName : msg.role === "error" ? "Something went wrong" : "You";
							return (
								<BubbleWrap key={msg.id} $role={msg.role}>
									<Bubble
										$role={msg.role}
										onTouchStart={() => handleLongPressStart(msg.id)}
										onTouchEnd={handleLongPressEnd}
										onTouchMove={handleLongPressEnd}
										onTouchCancel={handleLongPressEnd}
									>
										<BubbleLabel $color={labelColor}>
											{msg.role === "error" && <Icon name="error_outline" size={12} />}
											{label}
										</BubbleLabel>
										<BubbleBody>
											{msg.role === "ai" ? <Markdown text={msg.text} /> : <UserText>{msg.text}</UserText>}
										</BubbleBody>
									</Bubble>

									{msg.role === "ai" && isLast && !isGenerating && wasCutShort(msg.stopReason) && (
										<CutShort>
											<span>{cutShortLabel(msg.stopReason)}</span>
											<ContinueBtn type="button" onClick={() => redoLast(true)}>
												<Icon name="play_arrow" size={12} />
												Continue
											</ContinueBtn>
										</CutShort>
									)}

									{!isGenerating && (
										<MessageActions $open={openActionsId === msg.id}>
											{msg.role !== "error" && <CopyAction text={msg.text} />}
											{msg.role === "user" && (
												<MsgActionBtn type="button" onClick={() => handleEditMessage(msg.id)}>
													<Icon name="edit" size={14} />
													Edit
												</MsgActionBtn>
											)}
											{msg.role === "ai" && isLast && (
												<MsgActionBtn type="button" onClick={() => redoLast(false)}>
													<Icon name="refresh" size={14} />
													Retry
												</MsgActionBtn>
											)}
											<MsgActionBtn type="button" onClick={() => handleDeleteMessage(msg.id)}>
												<Icon name="delete" size={14} />
												{msg.role === "error" ? "Dismiss" : "Delete"}
											</MsgActionBtn>
										</MessageActions>
									)}
								</BubbleWrap>
							);
						})}

						{showStream && (
							<BubbleWrap $role="ai">
								<Bubble $role="ai">
									<BubbleLabel $color={accent}>{characterName}</BubbleLabel>
									<BubbleBody>
										{streamedText ? (
											<Markdown text={streamedText} />
										) : (
											<TypingDots role="status" aria-label="Generating a reply">
												<span />
												<span />
												<span />
											</TypingDots>
										)}
									</BubbleBody>
									{settings?.show_speed && tokensPerSecond > 0 && (
										<SpeedBadge>{tokensPerSecond.toFixed(1)} tok/s</SpeedBadge>
									)}
								</Bubble>
							</BubbleWrap>
						)}
					</MessagesArea>

					{!following && (messages.length > 0 || showStream) && (
						<JumpBtn
							type="button"
							onClick={() => {
								followingRef.current = true;
								setFollowing(true);
								scrollToBottom("smooth");
							}}
						>
							<Icon name="arrow_downward" size={14} />
							{isGenerating ? "Follow reply" : "Latest"}
						</JumpBtn>
					)}

					<InputBar>
						<InputRow>
							<TextInput
								ref={textareaRef}
								value={input}
								onChange={(e) => {
									setInput(e.target.value);
									writeDraft(e.target.value);
									autoResize();
								}}
								onKeyDown={handleKeyDown}
								placeholder={`Message ${characterName}…`}
								aria-label="Message"
								rows={1}
								maxLength={MAX_PROMPT_LENGTH}
								enterKeyHint={isTouchPrimary() ? "enter" : "send"}
							/>
							{input.length > MAX_PROMPT_LENGTH * 0.9 && (
								<CharCounter $over={input.length >= MAX_PROMPT_LENGTH}>
									{input.length.toLocaleString()} / {MAX_PROMPT_LENGTH.toLocaleString()}
								</CharCounter>
							)}
							{isGenerating ? (
								<RoundBtn type="button" $variant="stop" onClick={handleStop} aria-label="Stop generating">
									<Icon name="stop_circle" size={22} fill />
								</RoundBtn>
							) : (
								<RoundBtn
									type="button"
									$variant={hasText ? "send" : "idle"}
									onClick={handleSend}
									disabled={!hasText || isLoadingModel}
									aria-label="Send message"
								>
									<Icon name="arrow_upward" size={20} />
								</RoundBtn>
							)}
						</InputRow>
					</InputBar>
				</ChatContainer>
			</AppLayout>

			<CharacterPicker open={pickerOpen} onClose={() => setPickerOpen(false)} showModels />

			{showCoach && !pickerOpen && (
				<Coachmark role="status">
					<Icon name="touch_app" size={14} color={tokens.colors.primary} />
					<span>Tap the name above to switch character or model</span>
					<CoachClose type="button" onClick={dismissCoach} aria-label="Dismiss tip">
						<Icon name="close" size={14} />
					</CoachClose>
				</Coachmark>
			)}
		</>
	);
}
