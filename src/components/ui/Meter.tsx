import { tokens } from "@/theme/tokens";
import styled from "styled-components";

/* A five-step rating shown as segments, used for a model's relative answer
   quality and speed. The ratings compare models within the catalog; they are
   a guide to the trade-off, not a benchmark score. */

const Wrap = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: ${tokens.typography.fontSize.xs};
  color: ${tokens.colors.onSurfaceVariant};
  white-space: nowrap;
`;

const Segments = styled.span`
  display: inline-flex;
  gap: 2px;
`;

const Segment = styled.span<{ $on: boolean; $color: string }>`
  width: 9px;
  height: 4px;
  border-radius: 2px;
  background: ${({ $on, $color }) => ($on ? $color : tokens.colors.surfaceContainerHighest)};
`;

const STEPS = [1, 2, 3, 4, 5];

interface MeterProps {
	label: string;
	/** 1–5. */
	value: number;
	color?: string;
}

export function Meter({ label, value, color = tokens.colors.primary }: MeterProps) {
	return (
		<Wrap role="img" aria-label={`${label}: ${value} out of 5`}>
			{label}
			<Segments aria-hidden="true">
				{STEPS.map((step) => (
					<Segment key={step} $on={step <= value} $color={color} />
				))}
			</Segments>
		</Wrap>
	);
}

/** The quality and speed meters together, as they appear on model cards. */
export function ModelMeters({ quality, speed }: { quality: number; speed: number }) {
	return (
		<>
			<Meter label="Quality" value={quality} />
			<Meter label="Speed" value={speed} color={tokens.colors.secondary} />
		</>
	);
}
