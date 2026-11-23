import { Icon } from "@/components/ui/Icon";
import {
	SYSTEM_THEME_ID,
	THEMES,
	type ThemeDefinition,
	getTheme,
	isSystemTheme,
	systemPrefersLight,
	themeVariables,
} from "@/theme/themes";
import { tokens } from "@/theme/tokens";
import { type CSSProperties, useSyncExternalStore } from "react";
import styled from "styled-components";

/* One compact row of swatches. Each swatch is a tiny scene drawn with the
   theme's own variables (its typeface, corner shape, backdrop and texture),
   so the row shows how the themes differ in character, not only in color. */

const Row = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.5rem;
`;

const Tile = styled.button`
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding: 0;
  border: none;
  background: none;
  color: ${tokens.colors.onSurface};
  cursor: pointer;
  text-align: left;
  min-width: 0;

  &:focus-visible { outline: none; }
`;

/* Everything inside a swatch resolves the swatch's theme, because the
   theme's variables are set on this element (see `themeVariables`). */
const Swatch = styled.span<{ $active: boolean }>`
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 4.25rem;
  padding: 0.5rem;
  overflow: hidden;
  border-radius: ${tokens.borderRadius.xl};
  background: ${tokens.surfaces.page};
  color: ${tokens.colors.onSurface};
  box-shadow: 0 0 0 1px rgb(127 127 127 / 0.28);
  transition: transform ${tokens.transitions.fast}, box-shadow ${tokens.transitions.fast};

  ${Tile}:hover & { transform: translateY(-1px); }
  ${Tile}:active & { transform: scale(0.97); }
`;

/* The selection ring belongs to the picker, not the swatch, so it is drawn
   in the app's current accent color, outside the swatch's own variables. */
const Ring = styled.span<{ $active: boolean }>`
  display: block;
  border-radius: calc(${tokens.borderRadius.xl} + 3px);
  padding: 2px;
  box-shadow: 0 0 0 2px ${({ $active }) => ($active ? tokens.colors.primary : "transparent")};
  transition: box-shadow ${tokens.transitions.fast};

  ${Tile}:focus-visible & { box-shadow: 0 0 0 2px ${tokens.colors.onSurface}; }
`;

const Texture = styled.span`
  position: absolute;
  inset: 0;
  background: var(--overlay, none);
  opacity: var(--overlay-opacity, 0);
  pointer-events: none;
`;

const Letters = styled.span`
  position: relative;
  font-family: ${tokens.typography.fontFamily.headline};
  font-size: 1.125rem;
  font-weight: 700;
  line-height: 1;
  letter-spacing: var(--headline-tracking, 0);
`;

const Shapes = styled.span`
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.25rem;
`;

const Bar = styled.span`
  flex: 1;
  height: 0.625rem;
  border-radius: ${tokens.borderRadius.lg};
  background: ${tokens.colors.primary};
`;

const Dot = styled.span`
  width: 0.625rem;
  height: 0.625rem;
  border-radius: ${tokens.borderRadius.circle};
  background: ${tokens.colors.secondary};
`;

const Check = styled.span`
  position: absolute;
  top: 0.375rem;
  right: 0.375rem;
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${tokens.colors.primary};
  color: ${tokens.colors.onPrimaryFixed};
`;

const Name = styled.span<{ $active: boolean }>`
  padding: 0 0.125rem;
  font-size: ${tokens.typography.fontSize.xs};
  font-weight: ${({ $active }) => ($active ? 700 : 500)};
  color: ${({ $active }) => ($active ? tokens.colors.onSurface : tokens.colors.onSurfaceVariant)};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Caption = styled.p`
  margin-top: 0.5rem;
  padding: 0 0.125rem;
  font-size: ${tokens.typography.fontSize.xs};
  color: ${tokens.colors.onSurfaceVariant};
`;

/* "Match system": a row above the swatches with a two-segment pill. */
const SystemRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
  padding: 0.625rem 0.75rem;
  border: 1px solid ${tokens.colors.outlineVariant};
  border-radius: ${tokens.borderRadius.lg};
  background: ${tokens.colors.surfaceContainerLow};
`;

const SystemText = styled.span`
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
`;

const SystemTitle = styled.span`
  font-size: ${tokens.typography.fontSize.sm};
  font-weight: 600;
  color: ${tokens.colors.onSurface};
`;

const SystemHint = styled.span`
  font-size: ${tokens.typography.fontSize.xs};
  color: ${tokens.colors.onSurfaceVariant};
`;

const Segmented = styled.div`
  display: inline-flex;
  padding: 2px;
  gap: 2px;
  border: 1px solid ${tokens.colors.outlineVariant};
  border-radius: ${tokens.borderRadius.circle};
  background: ${tokens.colors.surfaceContainerLowest};
`;

const Segment = styled.button<{ $on: boolean }>`
  min-height: 2rem;
  padding: 0 0.875rem;
  border: none;
  border-radius: ${tokens.borderRadius.circle};
  background: ${({ $on }) => ($on ? tokens.colors.primary : "transparent")};
  color: ${({ $on }) => ($on ? tokens.colors.onPrimaryFixed : tokens.colors.onSurfaceVariant)};
  font-size: ${tokens.typography.fontSize.xs};
  font-weight: 600;
  cursor: pointer;
  transition: background ${tokens.transitions.fast}, color ${tokens.transitions.fast};

  &:hover { color: ${({ $on }) => ($on ? tokens.colors.onPrimaryFixed : tokens.colors.onSurface)}; }
`;

/* Re-render when the OS flips between light and dark, so the picker shows
   which theme "Match system" is painting right now. */
function subscribeScheme(listener: () => void): () => void {
	if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
	const query = window.matchMedia("(prefers-color-scheme: light)");
	query.addEventListener?.("change", listener);
	return () => query.removeEventListener?.("change", listener);
}

function useSystemPrefersLight(): boolean {
	return useSyncExternalStore(subscribeScheme, systemPrefersLight, () => false);
}

function ThemeSwatch({ theme, active }: { theme: ThemeDefinition; active: boolean }) {
	return (
		<Ring $active={active}>
			<Swatch $active={active} style={themeVariables(theme) as CSSProperties}>
				<Texture />
				<Letters>Aa</Letters>
				<Shapes>
					<Bar />
					<Dot />
				</Shapes>
				{active && (
					<Check>
						<Icon name="check" size={10} />
					</Check>
				)}
			</Swatch>
		</Ring>
	);
}

interface ThemePickerProps {
	/** A theme id from `THEMES`, or `"system"` to follow the OS. */
	value: string;
	onChange: (themeId: string) => void;
}

export function ThemePicker({ value, onChange }: ThemePickerProps) {
	const prefersLight = useSystemPrefersLight();
	const followSystem = isSystemTheme(value);
	// Read `prefersLight` so a live OS switch re-resolves the selection.
	const selected = followSystem ? getTheme(prefersLight ? "paper" : "karakoram") : getTheme(value);
	return (
		<div>
			<SystemRow>
				<SystemText>
					<SystemTitle>Match system</SystemTitle>
					<SystemHint>Karakoram when your device is dark, Paper when it is light</SystemHint>
				</SystemText>
				<Segmented role="radiogroup" aria-label="Theme mode">
					<Segment
						type="button"
						role="radio"
						aria-checked={followSystem}
						$on={followSystem}
						onClick={() => {
							if (!followSystem) onChange(SYSTEM_THEME_ID);
						}}
					>
						Auto (System)
					</Segment>
					<Segment
						type="button"
						role="radio"
						aria-checked={!followSystem}
						$on={!followSystem}
						onClick={() => {
							if (followSystem) onChange(selected.id);
						}}
					>
						Manual
					</Segment>
				</Segmented>
			</SystemRow>
			<Row role="radiogroup" aria-label="Theme">
				{THEMES.map((theme) => {
					const active = theme.id === selected.id;
					return (
						<Tile
							key={theme.id}
							type="button"
							role="radio"
							aria-checked={active && !followSystem}
							aria-label={`${theme.name}: ${theme.tagline}`}
							onClick={() => onChange(theme.id)}
						>
							<ThemeSwatch theme={theme} active={active} />
							<Name $active={active}>{theme.name}</Name>
						</Tile>
					);
				})}
			</Row>
			<Caption aria-live="polite">
				{followSystem ? `Following your device: ${selected.name}` : `${selected.name}: ${selected.tagline}`}
			</Caption>
		</div>
	);
}
