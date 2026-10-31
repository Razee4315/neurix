import { Icon } from "@/components/ui/Icon";
import { alpha } from "@/theme/alpha";
import { tokens } from "@/theme/tokens";
import { useState } from "react";
import styled from "styled-components";
import type { SlashCommand } from "./composerKeys";

/* The small pieces around the message box: the slash menu, the queue of
   messages waiting for the model, and the ring showing how full its memory is. */

/* ── Slash menu ── */

const Menu = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(100% + 0.375rem);
  padding: 0.25rem;
  background: ${tokens.colors.surfaceContainerHigh};
  border: 1px solid ${alpha(tokens.colors.outlineVariant, "cc")};
  border-radius: ${tokens.borderRadius.xl};
  z-index: ${tokens.zIndex.overlay};
`;

const MenuRow = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: baseline;
  gap: 0.625rem;
  width: 100%;
  min-height: 34px;
  padding: 0.4375rem 0.625rem;
  border: none;
  border-radius: ${tokens.borderRadius.lg};
  background: ${({ $active }) => ($active ? tokens.colors.surfaceContainerHighest : "transparent")};
  color: ${tokens.colors.onSurface};
  font-size: ${tokens.typography.fontSize.sm};
  text-align: left;
  cursor: pointer;

  code {
    font-family: ${tokens.typography.fontFamily.mono};
    font-size: ${tokens.typography.fontSize.xs};
    color: ${tokens.colors.primary};
  }

  span { color: ${tokens.colors.onSurfaceVariant}; font-size: ${tokens.typography.fontSize.xs}; }
`;

interface SlashMenuProps {
	commands: SlashCommand[];
	active: number;
	onPick: (command: SlashCommand) => void;
	onHover: (index: number) => void;
}

export function SlashMenu({ commands, active, onPick, onHover }: SlashMenuProps) {
	return (
		<Menu role="listbox" aria-label="Commands">
			{commands.map((command, i) => (
				<MenuRow
					key={command.id}
					type="button"
					role="option"
					aria-selected={i === active}
					$active={i === active}
					// Keeps focus in the message box, so the menu can't flicker shut.
					onMouseDown={(e) => e.preventDefault()}
					onMouseEnter={() => onHover(i)}
					onClick={() => onPick(command)}
				>
					<code>/{command.name}</code>
					<span>{command.hint}</span>
				</MenuRow>
			))}
		</Menu>
	);
}

/* ── Queue ── */

const Queue = styled.div`
  max-width: 48rem;
  margin: 0 auto 0.375rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const QueueRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  min-height: 36px;
  padding: 0 0.25rem 0 0.75rem;
  background: ${tokens.colors.surfaceContainer};
  border-radius: ${tokens.borderRadius.lg};
  font-size: ${tokens.typography.fontSize.sm};
  color: ${tokens.colors.onSurfaceVariant};

  > span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`;

const QueueNote = styled(QueueRow)`
  background: transparent;
  padding-left: 0.25rem;
  font-size: ${tokens.typography.fontSize.xs};
`;

const QueueBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border: none;
  border-radius: ${tokens.borderRadius.md};
  background: transparent;
  color: ${tokens.colors.onSurfaceVariant};
  cursor: pointer;

  &:hover { background: ${tokens.colors.surfaceContainerHighest}; color: ${tokens.colors.onSurface}; }
`;

const ResumeBtn = styled.button`
  flex-shrink: 0;
  height: 28px;
  padding: 0 0.625rem;
  border: none;
  border-radius: ${tokens.borderRadius.md};
  background: ${tokens.colors.surfaceContainerHigh};
  color: ${tokens.colors.onSurface};
  font-size: ${tokens.typography.fontSize.xs};
  font-weight: ${tokens.typography.fontWeight.medium};
  cursor: pointer;

  &:hover { background: ${tokens.colors.surfaceContainerHighest}; }
`;

export interface QueuedMessage {
	id: string;
	text: string;
}

interface QueueListProps {
	items: QueuedMessage[];
	/** Why the queue isn't moving, or null while it is. */
	paused: string | null;
	onEdit: (item: QueuedMessage) => void;
	onRemove: (id: string) => void;
	onResume: () => void;
}

export function QueueList({ items, paused, onEdit, onRemove, onResume }: QueueListProps) {
	if (items.length === 0) return null;
	return (
		<Queue aria-label="Waiting to send">
			{paused && (
				<QueueNote>
					<span>{paused}</span>
					<ResumeBtn type="button" onClick={onResume}>
						Send next
					</ResumeBtn>
				</QueueNote>
			)}
			{items.map((item) => (
				<QueueRow key={item.id}>
					<Icon name="schedule" size={14} />
					<span title={item.text}>{item.text}</span>
					<QueueBtn type="button" aria-label={`Edit: ${item.text}`} onClick={() => onEdit(item)}>
						<Icon name="edit" size={14} />
					</QueueBtn>
					<QueueBtn type="button" aria-label={`Remove: ${item.text}`} onClick={() => onRemove(item.id)}>
						<Icon name="close" size={14} />
					</QueueBtn>
				</QueueRow>
			))}
		</Queue>
	);
}

/* ── Memory ring ── */

const RING_RADIUS = 7.5;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

const Ring = styled.span`
  display: inline-flex;
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  margin-right: 0.125rem;

  circle { fill: none; stroke-width: 2.5; }
  circle:first-child { stroke: ${tokens.colors.surfaceContainerHighest}; }
  circle:last-child { transition: stroke-dashoffset 0.5s ease-out, stroke 0.2s; }
`;

/** Rough, for when the model hasn't reported a real count yet. */
export function estimateTokens(texts: string[]): number {
	return Math.ceil(texts.reduce((sum, text) => sum + text.length, 0) / 4);
}

export function MemoryRing({ used, total }: { used: number; total: number }) {
	if (total <= 0 || used <= 0) return null;
	const share = Math.min(used / total, 1);
	const color =
		share >= 0.9 ? tokens.colors.error : share >= 0.7 ? tokens.colors.secondary : tokens.colors.onSurfaceVariant;
	const label = `About ${used.toLocaleString()} of ${total.toLocaleString()} tokens of the model's memory used`;
	return (
		<Ring role="img" aria-label={label} title={label}>
			<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
				<circle cx="10" cy="10" r={RING_RADIUS} />
				<circle
					cx="10"
					cy="10"
					r={RING_RADIUS}
					stroke={color}
					strokeLinecap="round"
					strokeDasharray={RING_LENGTH}
					strokeDashoffset={RING_LENGTH * (1 - share)}
					transform="rotate(-90 10 10)"
				/>
			</svg>
		</Ring>
	);
}

/* ── Long messages ── */

const COLLAPSE_CHARS = 600;
const COLLAPSE_LINES = 8;

const Folded = styled.div<{ $open: boolean }>`
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  ${({ $open }) => ($open ? "" : "max-height: 12em; overflow: hidden;")}
`;

const MoreBtn = styled.button`
  display: block;
  margin-top: 0.25rem;
  padding: 0;
  border: none;
  background: none;
  color: ${tokens.colors.onSurfaceVariant};
  font-size: ${tokens.typography.fontSize.xs};
  cursor: pointer;

  &:hover { color: ${tokens.colors.onSurface}; text-decoration: underline; }
`;

/** A long paste shows as a few lines, so the reply isn't pushed out of sight. */
export function UserMessage({ text, expanded }: { text: string; expanded: boolean }) {
	const [open, setOpen] = useState(false);
	const long = text.length > COLLAPSE_CHARS || text.split("\n").length > COLLAPSE_LINES;
	const show = !long || open || expanded;
	return (
		<>
			<Folded dir="auto" $open={show}>
				{text}
			</Folded>
			{long && !expanded && (
				<MoreBtn type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
					{open ? "Show less" : "Show more"}
				</MoreBtn>
			)}
		</>
	);
}
