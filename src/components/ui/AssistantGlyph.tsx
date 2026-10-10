import type { IconWeight } from "@/theme/iconWeight";
import type { CSSProperties } from "react";

/**
 * The default assistant's face: a small friendly robot.
 *
 * Drawn for this app rather than taken from the icon set, whose robot has a
 * grille for a mouth that reads as bared teeth at avatar size. This one is
 * a rounded head, two eyes, a smile and an antenna, and nothing else, so it
 * stays legible at 18 pixels. It sits on the same 256-unit grid as the icon
 * set and follows the active theme's weight like any other icon.
 */
interface AssistantGlyphProps {
	size?: number | string;
	color?: string;
	weight?: IconWeight;
	className?: string;
	style?: CSSProperties;
}

/** Stroke width per weight, matching the icon set's proportions. */
const STROKE: Record<IconWeight, number> = {
	thin: 8,
	light: 12,
	regular: 16,
	duotone: 16,
	bold: 24,
	fill: 16,
};

const HEAD = { x: 36, y: 76, width: 184, height: 136, rx: 46 };
const EYES: ReadonlyArray<[number, number]> = [
	[98, 136],
	[158, 136],
];
const SMILE = "M104 170 Q128 190 152 170";

export function AssistantGlyph({
	size = 24,
	color = "currentColor",
	weight = "regular",
	className,
	style,
}: AssistantGlyphProps) {
	const stroke = STROKE[weight];
	const solid = weight === "fill";
	const eye = weight === "thin" || weight === "light" ? 12 : 16;

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
			{solid && (
				// Solid weight: the features are cut out of the head.
				<mask id="assistant-face">
					<rect width="256" height="256" fill="#fff" />
					{EYES.map(([cx, cy]) => (
						<circle key={cx} cx={cx} cy={cy} r="17" fill="#000" />
					))}
					<path d={SMILE} stroke="#000" strokeWidth="14" strokeLinecap="round" />
				</mask>
			)}

			{/* Antenna */}
			<path d="M128 76 V46" stroke={color} strokeWidth={stroke} strokeLinecap="round" />
			<circle cx="128" cy="34" r={solid || weight === "bold" ? 16 : 13} fill={color} />

			{/* Head */}
			{solid ? (
				<rect {...HEAD} fill={color} mask="url(#assistant-face)" />
			) : (
				<>
					{weight === "duotone" && <rect {...HEAD} fill={color} opacity="0.2" />}
					<rect {...HEAD} stroke={color} strokeWidth={stroke} strokeLinejoin="round" />
					{EYES.map(([cx, cy]) => (
						<circle key={cx} cx={cx} cy={cy} r={eye} fill={color} />
					))}
					<path d={SMILE} stroke={color} strokeWidth={Math.min(stroke, 16)} strokeLinecap="round" />
				</>
			)}
		</svg>
	);
}
