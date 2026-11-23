import { alpha } from "@/theme/alpha";
import { tokens } from "@/theme/tokens";
import styled, { keyframes } from "styled-components";
import type { Message } from "./messages";

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

export const ChatContainer = styled.div<{ $hero?: boolean }>`
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
  ${({ $hero }) => ($hero ? "justify-content: center; padding-bottom: 8vh;" : "")}
`;

export const MessagesArea = styled.div<{ $wide?: boolean; $hero?: boolean }>`
  flex: ${({ $hero }) => ($hero ? "0 0 auto" : "1")};
  overflow-y: auto;
  overflow-anchor: none;
  /* Room under the header band, so the first message (and a Large text or
     Paper heading) is never tucked under it; scroll-padding keeps Find and
     jump-to-message landing below it too. */
  padding: 2rem 1.25rem 1rem;
  scroll-padding-top: 2rem;

  @media (max-width: 600px) { padding: 1.25rem 0.875rem 0.75rem; scroll-padding-top: 1.25rem; }

  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  width: 100%;
  max-width: ${({ $wide }) => ($wide ? "64rem" : "48rem")};
  margin: 0 auto;

  &::-webkit-scrollbar { width: 0; }
  scrollbar-width: none;
`;

export const BubbleWrap = styled.div<{ $role: Message["role"]; $still?: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: ${({ $role }) => ($role === "user" ? "flex-end" : "flex-start")};
  animation: ${fadeInUp} 0.25s ease-out both;

  /* A virtualized row mounts again as it scrolls into view: no entrance. */
  &[data-still="true"] { animation: none; }
`;

/* Long chats draw only the rows near the view. The list keeps the full
   height so the scrollbar and stick-to-bottom behave as before. */
export const VirtualList = styled.div`
  position: relative;
  width: 100%;
  flex-shrink: 0;
`;

export const VirtualRow = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  padding-bottom: 1.25rem;
`;

/* < 1 / 3 > under a branched message. */
export const VariantSwitch = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.125rem;
  margin-top: 0.375rem;
  font-family: ${tokens.typography.fontFamily.mono};
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: ${tokens.colors.onSurfaceVariant};

  > span { min-width: 2.75rem; text-align: center; }
`;

export const VariantBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: ${tokens.borderRadius.md};
  background: transparent;
  color: ${tokens.colors.onSurfaceVariant};
  cursor: pointer;

  &:hover:not(:disabled) { background: ${tokens.colors.surfaceContainerHigh}; color: ${tokens.colors.onSurface}; }
  &:disabled { opacity: 0.35; cursor: default; }
  &:focus-visible { outline: 2px solid ${tokens.colors.primary}; outline-offset: 1px; }

  &[data-dir="back"] svg { transform: rotate(180deg); }

  @media (hover: none) { width: 36px; height: 36px; }
`;

export const Bubble = styled.div<{ $role: Message["role"] }>`
  font-size: 0.9375rem;
  line-height: 1.65;
  color: ${tokens.colors.onSurface};
  ${({ $role }) =>
		$role === "user"
			? `
    max-width: min(80%, 40rem);
    padding: 0.625rem 1rem;
    border-radius: 1rem;
    background: ${tokens.colors.surfaceContainerHigh};
  `
			: $role === "error"
				? `
    max-width: 100%;
    padding: 0.75rem 1rem;
    border-radius: 0.75rem;
    background: ${alpha(tokens.colors.error, "14")};
    border: 1px solid ${alpha(tokens.colors.error, "40")};
  `
				: `
    width: 100%;
    padding: 0.125rem 0;
  `}
`;

export const BubbleLabel = styled.span<{ $color: string }>`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: ${tokens.typography.fontSize.xs};
  font-weight: ${tokens.typography.fontWeight.semibold};
  letter-spacing: ${tokens.typography.letterSpacing.wide};
  margin-bottom: 0.25rem;
  color: ${({ $color }) => $color};
`;

export const BubbleBody = styled.div`
  word-break: break-word;
  user-select: text;
  -webkit-user-select: text;
`;

/* What a reply looked at. Not proof it used all of it, so it says "Looked at". */
export const SourcesLine = styled.div`
  display: flex;
  align-items: baseline;
  gap: 0.375rem;
  margin-top: 0.5rem;
  font-size: ${tokens.typography.fontSize.xs};
  color: ${tokens.colors.onSurfaceVariant};
  overflow-wrap: anywhere;

  svg { flex-shrink: 0; align-self: center; }
`;

/* ── Message actions ──
   Pointer devices: the row always occupies its space (no layout shift) and
   fades in on hover or keyboard focus. Touch devices: collapsed until the
   bubble is long-pressed. */

export const MessageActions = styled.div<{ $open: boolean }>`
  display: flex;
  gap: 0.125rem;
  margin-top: 0.375rem;
  transition: opacity ${tokens.transitions.fast};

  @media (hover: hover) {
    opacity: ${({ $open }) => ($open ? 1 : 0)};
    ${BubbleWrap}:hover &,
    ${BubbleWrap}:focus-within &,
    ${BubbleWrap}[data-last="true"] & { opacity: 1; }
  }

  @media (hover: none) {
    display: ${({ $open }) => ($open ? "flex" : "none")};
  }
`;

export const MsgActionBtn = styled.button<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  background: transparent;
  border: none;
  border-radius: ${tokens.borderRadius.lg};
  cursor: pointer;
  color: ${({ $active }) => ($active ? tokens.colors.secondary : tokens.colors.onSurfaceVariant)};
  transition: background ${tokens.transitions.fast}, color ${tokens.transitions.fast};

  &:hover { background: ${tokens.colors.surfaceContainerHigh}; color: ${tokens.colors.onSurface}; }

  @media (hover: none) { width: 38px; height: 38px; }
`;

export const CutShort = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.375rem;
  font-size: ${tokens.typography.fontSize.xs};
  color: ${tokens.colors.onSurfaceVariant};
`;

export const ContinueBtn = styled.button`
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

export const TypingDots = styled.div`
  display: flex;
  gap: 5px;
  padding: 0.5rem 0;

  span {
    width: 7px;
    height: 7px;
    border-radius: ${tokens.borderRadius.circle};
    background: ${tokens.colors.primary};
    animation: ${dotPulse} 1.2s ease-in-out infinite;

    &:nth-child(2) { animation-delay: 0.2s; }
    &:nth-child(3) { animation-delay: 0.4s; }
  }
`;

export const SpeedBadge = styled.span`
  font-size: 10px;
  font-family: ${tokens.typography.fontFamily.mono};
  color: ${tokens.colors.onSurfaceVariant};
  padding: 0.125rem 0.375rem;
  background: ${tokens.colors.surfaceContainerHighest};
  border-radius: ${tokens.borderRadius.md};
  margin-top: 0.375rem;
  display: inline-block;
`;

export const ContextNotice = styled.div`
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

export const JumpBtn = styled.button`
  position: absolute;
  left: 50%;
  bottom: 9rem;
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

export const Welcome = styled.div<{ $hero?: boolean }>`
  flex: ${({ $hero }) => ($hero ? "0 0 auto" : "1")};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 1rem 0.5rem 1.5rem;
  text-align: center;
  animation: ${fadeInUp} 0.3s ease-out both;
`;

/* ── Workspace welcome ──
   An empty chat opens on a working card, not a greeting: who is answering,
   which model is in memory (or warming up), that nothing leaves the device,
   and four ways to start. Left-aligned, with the identity rail on the left. */

export const WorkspaceWelcome = styled.section<{ $hero?: boolean }>`
  flex: ${({ $hero }) => ($hero ? "0 0 auto" : "1")};
  display: flex;
  flex-direction: column;
  justify-content: ${({ $hero }) => ($hero ? "flex-end" : "center")};
  width: 100%;
  padding: 0.5rem 0 1rem;
  animation: ${fadeInUp} 0.3s ease-out both;

  @media (prefers-reduced-motion: reduce) { animation: none; }
`;

export const WorkspaceCard = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.875rem 1.25rem;
  width: 100%;
  padding: 1.25rem 1.25rem 1.125rem 1.375rem;
  background: ${tokens.colors.surfaceContainerLow};
  border: 1px solid ${alpha(tokens.colors.outlineVariant, "cc")};
  border-left: 3px solid ${tokens.colors.primary};
  border-radius: ${tokens.borderRadius.lg};
  text-align: left;

  @media (max-width: 600px) {
    grid-template-columns: minmax(0, 1fr);
    padding: 1rem 0.875rem 0.875rem 1rem;
  }
`;

export const WorkspaceHead = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 0;
`;

export const PersonaPill = styled.button<{ $accent: string }>`
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  max-width: 100%;
  height: 26px;
  padding: 0 0.5rem 0 0.25rem;
  border: 1px solid ${alpha(tokens.colors.outlineVariant, "cc")};
  border-radius: ${tokens.borderRadius.md};
  background: ${tokens.colors.surfaceContainer};
  color: ${tokens.colors.onSurface};
  font-size: ${tokens.typography.fontSize.xs};
  font-weight: ${tokens.typography.fontWeight.medium};
  cursor: pointer;

  > i {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: ${tokens.borderRadius.sm};
    background: ${({ $accent }) => alpha($accent, "26")};
    color: ${({ $accent }) => $accent};
  }
  > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  &:hover { background: ${tokens.colors.surfaceContainerHigh}; }
  &:focus-visible { outline: 2px solid ${tokens.colors.primary}; outline-offset: 2px; }
`;

export const WorkspaceTitle = styled.h2`
  margin: 0;
  font-family: ${tokens.typography.fontFamily.headline};
  font-size: 1.5rem;
  font-weight: ${tokens.typography.fontWeight.semibold};
  letter-spacing: -0.015em;
  line-height: 1.2;
  color: ${tokens.colors.onSurface};
  overflow-wrap: anywhere;

  @media (max-width: 600px) { font-size: 1.25rem; }
`;

export const WorkspaceLede = styled.p`
  margin: 0;
  max-width: 34rem;
  font-size: ${tokens.typography.fontSize.sm};
  line-height: ${tokens.typography.lineHeight.relaxed};
  color: ${tokens.colors.onSurfaceVariant};
`;

/* Right column on a computer, a row under the title on a phone. */
export const TrustColumn = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.375rem;

  @media (max-width: 600px) { flex-direction: row; flex-wrap: wrap; align-items: center; }
`;

export const TrustBadge = styled.span<{ $strict?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 0.3125rem;
  height: 24px;
  padding: 0 0.5rem;
  border-radius: ${tokens.borderRadius.md};
  border: 1px solid ${({ $strict }) => ($strict ? alpha(tokens.colors.secondary, "80") : alpha(tokens.colors.outlineVariant, "cc"))};
  background: ${({ $strict }) => ($strict ? alpha(tokens.colors.secondary, "14") : "transparent")};
  color: ${({ $strict }) => ($strict ? tokens.colors.secondary : tokens.colors.onSurfaceVariant)};
  font-size: 11px;
  font-weight: ${tokens.typography.fontWeight.medium};
  white-space: nowrap;
`;

export const EngineLine = styled.div`
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.375rem 0.5rem;
  padding-top: 0.75rem;
  border-top: 1px solid ${alpha(tokens.colors.outlineVariant, "99")};
  font-size: ${tokens.typography.fontSize.xs};
  color: ${tokens.colors.onSurfaceVariant};

  > strong {
    font-weight: ${tokens.typography.fontWeight.semibold};
    color: ${tokens.colors.onSurface};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 18rem;
  }
`;

export const EngineTag = styled.span`
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 0.375rem;
  border-radius: ${tokens.borderRadius.sm};
  background: ${tokens.colors.surfaceContainerHigh};
  font-family: ${tokens.typography.fontFamily.mono};
  font-size: 10.5px;
  color: ${tokens.colors.onSurfaceVariant};
  white-space: nowrap;
`;

const warmSweep = keyframes`
  from { transform: translateX(-100%); }
  to { transform: translateX(250%); }
`;

/* The model is still loading: say so calmly. Typing works meanwhile. */
export const WarmingTrack = styled.span`
  position: relative;
  flex: 1 1 6rem;
  max-width: 12rem;
  height: 3px;
  border-radius: 2px;
  background: ${tokens.colors.surfaceContainerHighest};
  overflow: hidden;

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    width: 40%;
    background: ${tokens.colors.primary};
    border-radius: 2px;
    animation: ${warmSweep} 1.6s cubic-bezier(0.22, 1, 0.36, 1) infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    &::after { animation: none; width: 100%; opacity: 0.5; }
  }
`;

export const WorkspaceStarters = styled.div`
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;

  @media (max-width: 480px) { grid-template-columns: 1fr; }
`;

/* A friend's empty chat: their face and name, then their greeting as the
   first message, so the chat opens the way talking to a person does. */
export const FriendHero = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
`;

export const FriendAvatar = styled.div<{ $accent: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  margin-bottom: 0.25rem;
  border-radius: 50%;
  background: ${({ $accent }) => alpha($accent, "26")};
  border: 1px solid ${({ $accent }) => alpha($accent, "55")};
  color: ${({ $accent }) => $accent};
`;

export const FriendName = styled.h2`
  margin: 0;
  font-family: ${tokens.typography.fontFamily.headline};
  font-size: ${tokens.typography.fontSize["2xl"]};
  font-weight: ${tokens.typography.fontWeight.semibold};
  color: ${tokens.colors.onSurface};
  letter-spacing: -0.01em;
`;

export const FriendMeta = styled.div`
  font-size: ${tokens.typography.fontSize.sm};
  color: ${tokens.colors.onSurfaceVariant};
  max-width: 26rem;
`;

export const FriendGreeting = styled.div<{ $accent: string }>`
  align-self: center;
  max-width: min(30rem, 92%);
  margin-top: 0.5rem;
  padding: 0.75rem 1rem;
  border-radius: 16px 16px 16px 4px;
  background: ${tokens.colors.surfaceContainerHigh};
  border-left: 3px solid ${({ $accent }) => $accent};
  color: ${tokens.colors.onSurface};
  font-size: ${tokens.typography.fontSize.base};
  line-height: 1.55;
  text-align: left;
  white-space: pre-wrap;
`;

export const StartersGrid = styled.div<{ $hero?: boolean }>`
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.5rem;
  width: 100%;
  max-width: ${({ $hero }) => ($hero ? "48rem" : "34rem")};
  margin: ${({ $hero }) => ($hero ? "0.25rem auto 0" : "0.5rem 0 0")};
  ${({ $hero }) => ($hero ? "padding: 0 1rem;" : "")}

  @media (min-width: 560px) { grid-template-columns: 1fr 1fr; }
`;

export const StarterChip = styled.button<{ $accent: string }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.875rem;
  background: transparent;
  border: 1px solid ${alpha(tokens.colors.outlineVariant, "cc")};
  border-radius: ${tokens.borderRadius.xl};
  color: ${tokens.colors.onSurfaceVariant};
  font-size: ${tokens.typography.fontSize.sm};
  font-family: ${tokens.typography.fontFamily.body};
  text-align: left;
  cursor: pointer;
  transition: background ${tokens.transitions.fast}, color ${tokens.transitions.fast};

  &:hover { background: ${tokens.colors.surfaceContainerHigh}; color: ${tokens.colors.onSurface}; }

  svg { margin-left: auto; color: ${tokens.colors.onSurfaceVariant}; }
`;

export const PrimaryCta = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  border-radius: ${tokens.borderRadius.xl};
  background: ${tokens.colors.primary};
  color: ${tokens.colors.onPrimaryFixed};
  font-size: ${tokens.typography.fontSize.sm};
  font-weight: ${tokens.typography.fontWeight.bold};
  border: none;
  cursor: pointer;

  &:active { transform: scale(0.96); }
`;

export const SecondaryCta = styled.button`
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

export const InputBar = styled.div`
  flex-shrink: 0;
  padding: 0 1rem 0.625rem;

  @media (max-width: 600px) { padding: 0 0.5rem 0.5rem; }
`;

/* The composer: one rounded card with the text on top and the tools,
   model picker and send button on a row underneath. */
export const ComposerBox = styled.div`
  position: relative;
  max-width: 48rem;
  margin: 0 auto;
  padding: 0.75rem 0.75rem 0.5rem 1rem;
  background: ${tokens.colors.surfaceContainerHigh};
  border: 1px solid ${alpha(tokens.colors.outlineVariant, "cc")};
  border-radius: 1.25rem;

  @media (max-width: 600px) {
    padding: 0.625rem 0.5rem 0.375rem 0.875rem;
    border-radius: 1.125rem;
  }
  transition: border-color ${tokens.transitions.fast};

  &:focus-within { border-color: ${tokens.colors.outline}; }
`;

export const ComposerBar = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 0.375rem;
  margin-top: 0.375rem;
  min-height: 34px;

  @media (max-width: 480px) {
    flex-wrap: wrap;
    justify-content: flex-end;
  }
`;

/* A connected folder in the composer: lit when it is used for this chat. */
export const FolderChip = styled.button<{ $on: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  max-width: 12rem;
  height: 32px;
  padding: 0 0.625rem;
  border-radius: ${tokens.borderRadius.lg};
  border: 1px solid ${({ $on }) => ($on ? alpha(tokens.colors.primary, "80") : alpha(tokens.colors.outlineVariant, "cc"))};
  background: ${({ $on }) => ($on ? alpha(tokens.colors.primary, "1f") : "transparent")};
  color: ${({ $on }) => ($on ? tokens.colors.primary : tokens.colors.onSurfaceVariant)};
  font-size: ${tokens.typography.fontSize.sm};
  cursor: pointer;

  @media (max-width: 600px) { max-width: 9rem; }

  > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`;

export const ComposerSpacer = styled.div`
  flex: 1;
`;

/* Think and the source chips. On a narrow screen they scroll sideways
   instead of pushing the model picker and Send out of the box. */
export const ComposerChips = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }

  /* A phone fits only a chip or two: fade the edge so the rest read as
     scrollable instead of cut off. */
  @media (max-width: 600px) {
    -webkit-mask-image: linear-gradient(to right, #000 calc(100% - 1.25rem), transparent);
    mask-image: linear-gradient(to right, #000 calc(100% - 1.25rem), transparent);
  }

  @media (max-width: 480px) {
    min-width: min-content;
    max-width: 100%;
    -webkit-mask-image: none;
    mask-image: none;
  }

  > * { flex-shrink: 0; }
`;

export const ComposerNote = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding-top: 0.5rem;
  font-size: 11.5px;
  color: ${tokens.colors.onSurfaceVariant};
`;


export const CharCounter = styled.span<{ $over: boolean }>`
  position: absolute;
  top: -1.5rem;
  right: 0.75rem;
  font-size: 11px;
  font-family: ${tokens.typography.fontFamily.mono};
  color: ${({ $over }) => ($over ? tokens.colors.error : tokens.colors.onSurfaceVariant)};
  background: ${tokens.colors.surfaceContainer};
  padding: 0.125rem 0.375rem;
  border-radius: ${tokens.borderRadius.md};
  pointer-events: none;
`;

export const TextInput = styled.textarea`
  display: block;
  width: 100%;
  min-height: 28px;
  max-height: 220px;
  padding: 0.25rem 0;
  background: transparent;
  border: none;
  font-size: 0.9375rem;
  font-family: ${tokens.typography.fontFamily.body};
  color: ${tokens.colors.onSurface};
  resize: none;
  outline: none;
  line-height: 1.5;

  /* Android WebView reserves a scrollbar gutter on textarea even when
     content fits. Hide the visual; the textarea stays scrollable. */
  &::-webkit-scrollbar { width: 0; height: 0; }
  scrollbar-width: none;

  &::placeholder { color: ${tokens.colors.outline}; }
`;

export const RoundBtn = styled.button<{ $variant: "send" | "idle" | "stop" }>`
  width: 32px;
  height: 32px;
  border-radius: ${tokens.borderRadius.lg};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  border: none;
  transition: background ${tokens.transitions.fast}, opacity ${tokens.transitions.fast};
  ${({ $variant }) =>
		$variant === "send"
			? `color: ${tokens.colors.onPrimary}; background: ${tokens.colors.primary};`
			: $variant === "stop"
				? `color: ${tokens.colors.onSurface}; background: ${tokens.colors.surfaceContainerHighest};`
				: `color: ${tokens.colors.onPrimary}; background: ${alpha(tokens.colors.primary, "66")};`}

  &:not(:disabled):hover { filter: brightness(1.08); }
  &:disabled { cursor: default; }
`;

/* ── Top bar ── */

export const TopBarBtn = styled.button`
  width: 34px;
  height: 34px;
  border-radius: ${tokens.borderRadius.lg};
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

  /* The open sidebar already offers this one (New chat): don't show it twice. */
  @media (min-width: ${tokens.breakpoints.wide}) {
    html[data-sidebar="open"] &[data-sidebar-dup="true"] { display: none; }
  }

  @media (max-width: 480px) {
    &[data-narrow-hide="true"] { display: none; }
  }
`;

/* Header pill (character + model): the primary identity element for the
   chat page. One tap target that opens the character and model switcher. */

export const HeaderPill = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3125rem 0.5rem;
  background: transparent;
  border: none;
  border-radius: ${tokens.borderRadius.lg};
  color: ${tokens.colors.onSurface};
  cursor: pointer;
  transition: background ${tokens.transitions.fast};
  max-width: 100%;
  min-width: 0;
  text-align: left;

  &:hover { background: ${tokens.colors.surfaceContainerHigh}; }
  &:active { background: ${tokens.colors.surfaceContainerHighest}; }
`;

/* The character's face in the header: a flat disc in its accent color. */
export const HeaderAvatar = styled.span<{ $accent: string }>`
  width: 26px;
  height: 26px;
  border-radius: ${tokens.borderRadius.lg};
  background: ${tokens.colors.surfaceContainerHighest};
  color: ${tokens.colors.primary};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

export const HeaderTextStack = styled.span`
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 1px;
`;

export const HeaderCharName = styled.span`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-family: ${tokens.typography.fontFamily.headline};
  font-size: ${tokens.typography.fontSize.base};
  font-weight: ${tokens.typography.fontWeight.medium};
  line-height: 1.1;
  min-width: 0;

  > span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 9rem;
  }
`;



/* First-run tip so the switcher doesn't go undiscovered. It sits in the
   page flow above the chat, so it can never cover a reply. */

export const Coachmark = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: calc(100% - 2.5rem);
  max-width: 48rem;
  margin: 0.75rem auto 0;
  padding: 0.5rem 0.375rem 0.5rem 0.75rem;
  flex-shrink: 0;
  background: ${tokens.colors.surfaceContainer};
  color: ${tokens.colors.onSurface};
  border: 1px solid ${alpha(tokens.colors.outlineVariant, "cc")};
  border-left: 3px solid ${tokens.colors.primary};
  border-radius: ${tokens.borderRadius.md};
  font-size: ${tokens.typography.fontSize.xs};
  animation: ${fadeInUp} 0.25s ease-out both;

  > span { flex: 1; min-width: 0; }

  @media (max-width: 600px) { width: calc(100% - 1.75rem); }
  @media (prefers-reduced-motion: reduce) { animation: none; }
`;

export const CoachClose = styled.button`
  border: none;
  background: transparent;
  color: ${tokens.colors.onSurfaceVariant};
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 0.25rem;
  min-width: 28px;
  min-height: 28px;
  justify-content: center;
  border-radius: ${tokens.borderRadius.md};

  &:hover { background: ${tokens.colors.surfaceContainerHigh}; color: ${tokens.colors.onSurface}; }
`;
