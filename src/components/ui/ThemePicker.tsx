import { Icon } from "@/components/ui/Icon";
import { alpha } from "@/theme/alpha";
import { THEMES, type ThemeDefinition } from "@/theme/themes";
import { tokens } from "@/theme/tokens";
import styled from "styled-components";

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr));
  gap: 0.625rem;
`;

const Card = styled.button<{ $active: boolean }>`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem;
  border-radius: ${tokens.borderRadius.xl};
  border: 1.5px solid ${({ $active }) => ($active ? tokens.colors.primary : alpha(tokens.colors.outlineVariant, "80"))};
  background: ${tokens.colors.surfaceContainerHigh};
  color: ${tokens.colors.onSurface};
  text-align: left;
  cursor: pointer;
  transition: transform ${tokens.transitions.fast}, border-color ${tokens.transitions.fast};

  &:hover { transform: translateY(-2px); }
  &:active { transform: scale(0.97); }
`;

const Preview = styled.svg`
  width: 100%;
  height: auto;
  border-radius: ${tokens.borderRadius.lg};
  display: block;
`;

const Name = styled.div`
  font-family: ${tokens.typography.fontFamily.headline};
  font-size: ${tokens.typography.fontSize.sm};
  font-weight: ${tokens.typography.fontWeight.bold};
  padding: 0 0.25rem;
`;

const Tagline = styled.div`
  font-size: 11px;
  color: ${tokens.colors.onSurfaceVariant};
  line-height: 1.3;
  padding: 0 0.25rem 0.25rem;
`;

const Check = styled.span`
  position: absolute;
  top: 0.875rem;
  right: 0.875rem;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${tokens.colors.primary};
  color: ${tokens.colors.onPrimaryFixed};
`;

/** A miniature of the chat screen drawn in the theme's own colors. */
function ThemePreview({ theme }: { theme: ThemeDefinition }) {
	const c = theme.colors;
	return (
		<Preview viewBox="0 0 160 96" aria-hidden="true">
			<rect width="160" height="96" fill={c.background} />
			<rect width="160" height="18" fill={c.surfaceContainerLow} />
			<circle cx="14" cy="9" r="5" fill={c.primary} opacity="0.9" />
			<rect x="24" y="6" width="38" height="6" rx="3" fill={c.onSurface} opacity="0.85" />
			<rect x="12" y="28" width="84" height="20" rx="8" fill={c.surfaceContainerHigh} />
			<rect x="20" y="35" width="52" height="5" rx="2.5" fill={c.onSurfaceVariant} opacity="0.8" />
			<rect x="68" y="54" width="80" height="18" rx="8" fill={c.primary} opacity="0.28" />
			<rect x="76" y="60" width="46" height="5" rx="2.5" fill={c.onSurface} opacity="0.85" />
			<rect x="12" y="80" width="112" height="10" rx="5" fill={c.surfaceContainerHigh} />
			<circle cx="140" cy="85" r="7" fill={c.primaryContainer} />
			<circle cx="148" cy="9" r="3" fill={c.secondary} />
		</Preview>
	);
}

interface ThemePickerProps {
	value: string;
	onChange: (themeId: string) => void;
}

export function ThemePicker({ value, onChange }: ThemePickerProps) {
	return (
		<Grid role="radiogroup" aria-label="Theme">
			{THEMES.map((theme) => {
				const active = theme.id === value;
				return (
					<Card
						key={theme.id}
						type="button"
						role="radio"
						aria-checked={active}
						$active={active}
						onClick={() => onChange(theme.id)}
					>
						<ThemePreview theme={theme} />
						{active && (
							<Check>
								<Icon name="check" size={14} />
							</Check>
						)}
						<Name>{theme.name}</Name>
						<Tagline>{theme.tagline}</Tagline>
					</Card>
				);
			})}
		</Grid>
	);
}
