import type { IconWeight } from "@/theme/iconWeight";
import type { CSSProperties } from "react";

/**
 * The Neurix mark as an icon: two brackets around a point.
 *
 * It is the face of the default assistant, in place of the sparkle every AI
 * product uses. It is drawn on the same 256-unit grid as the rest of the
 * icon set and follows the active theme's weight like any other icon.
 */
interface NeurixGlyphProps {
	size?: number | string;
	color?: string;
	weight?: IconWeight;
	className?: string;
	style?: CSSProperties;
}

/** Stroke width per weight, matching the icon set's own proportions. */
const STROKE: Record<IconWeight, number> = {
	thin: 8,
	light: 12,
	regular: 16,
	duotone: 18,
	bold: 24,
	fill: 28,
};

/** The point in the middle grows with the strokes so the mark stays balanced. */
const DOT: Record<IconWeight, number> = {
	thin: 12,
	light: 14,
	regular: 17,
	duotone: 20,
	bold: 22,
	fill: 26,
};

export function NeurixGlyph({
	size = 24,
	color = "currentColor",
	weight = "regular",
	className,
	style,
}: NeurixGlyphProps) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={size}
			height={size}
			viewBox="0 0 256 256"
			fill="none"
			className={className}
			style={style}
			aria-hidden="true"
			focusable="false"
		>
			<path
				d="M96 48H52v160h44M160 48h44v160h-44"
				stroke={color}
				strokeWidth={STROKE[weight]}
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<circle cx="128" cy="128" r={DOT[weight]} fill={color} />
		</svg>
	);
}
