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

export const ChatContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
`;

export const MessagesArea = styled.div`
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

export const BubbleWrap = styled.div<{ $role: Message["role"] }>`
  display: flex;
  flex-direction: column;
  align-items: ${({ $role }) => ($role === "user" ? "flex-end" : "flex-start")};
  animation: ${fadeInUp} 0.25s ease-out both;
`;

export const Bubble = styled.div<{ $role: Message["role"] }>`
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

export const UserText = styled.div`
  white-space: pre-wrap;
`;

/* ── Message actions ──
   Pointer devices: the row always occupies its space (no layout shift) and
   fades in on hover or keyboard focus. Touch devices: collapsed until the
   bubble is long-pressed. */

export const MessageActions = styled.div<{ $open: boolean }>`
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

export const MsgActionBtn = styled.button<{ $active?: boolean }>`
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

export const Welcome = styled.div`
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

export const WelcomeTitle = styled.h2`
  font-family: ${tokens.typography.fontFamily.headline};
  font-size: ${tokens.typography.fontSize.xl};
  font-weight: ${tokens.typography.fontWeight.bold};
  color: ${tokens.colors.onSurface};
`;

export const WelcomeText = styled.p`
  font-size: ${tokens.typography.fontSize.base};
  color: ${tokens.colors.onSurfaceVariant};
  max-width: 20rem;
  line-height: ${tokens.typography.lineHeight.relaxed};
`;

export const StartersGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.5rem;
  width: 100%;
  max-width: 34rem;
  margin-top: 0.5rem;

  @media (min-width: 560px) { grid-template-columns: 1fr 1fr; }
`;

export const StarterChip = styled.button<{ $accent: string }>`
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

export const PrimaryCta = styled.button`
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
  background: ${tokens.colors.surfaceContainer};
  border-top: 1px solid ${alpha(tokens.colors.outlineVariant, "4d")};
`;

export const InputRow = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem 0.625rem;
  max-width: 52rem;
  margin: 0 auto;
  position: relative;
`;

export const CharCounter = styled.span<{ $over: boolean }>`
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

export const TextInput = styled.textarea`
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

export const RoundBtn = styled.button<{ $variant: "send" | "idle" | "stop" }>`
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

export const TopBarBtn = styled.button`
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

export const HeaderPill = styled.button`
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

export const HeaderAvatar = styled.span<{ $accent: string }>`
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

export const HeaderModelLine = styled.span`
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

export const ModelDot = styled.span<{ $on: boolean }>`
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

export const Coachmark = styled.div`
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

export const CoachClose = styled.button`
  border: none;
  background: transparent;
  color: ${tokens.colors.onSurfaceVariant};
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 0.25rem;
`;
