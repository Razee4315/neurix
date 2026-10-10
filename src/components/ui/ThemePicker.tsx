import { Icon } from "@/components/ui/Icon";
import { THEMES, type ThemeDefinition, getTheme, themeVariables } from "@/theme/themes";
import { tokens } from "@/theme/tokens";
import type { CSSProperties } from "react";
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
	value: string;
	onChange: (themeId: string) => void;
}

export function ThemePicker({ value, onChange }: ThemePickerProps) {
	const selected = getTheme(value);
	return (
		<div>
			<Row role="radiogroup" aria-label="Theme">
				{THEMES.map((theme) => {
					const active = theme.id === selected.id;
					return (
						<Tile
							key={theme.id}
							type="button"
							role="radio"
							aria-checked={active}
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
				{selected.name}: {selected.tagline}
			</Caption>
		</div>
	);
}
