interface NeurixLogoProps {
	size?: number;
	className?: string;
}

interface MarkProps {
	size?: number;
	className?: string;
	/**
	 * Color of the thin gap around the diagonal. It should match whatever
	 * the mark sits on, so the ribbon reads as lying over the pillars.
	 */
	knockout?: string;
}

/**
 * The Neurix mark: an N made of two pillars and a clay ribbon laid across
 * them. Pillars take the text color, the ribbon the accent.
 */
export function NeurixMark({ size = 24, className, knockout = "rgb(var(--c-background))" }: MarkProps) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			className={className}
			aria-hidden="true"
			focusable="false"
			style={{ flexShrink: 0 }}
		>
			<g fill="rgb(var(--c-on-surface))">
				<rect x="4" y="4" width="4.2" height="16" rx="2.1" />
				<rect x="15.8" y="4" width="4.2" height="16" rx="2.1" />
			</g>
			<line x1="6.1" y1="6.1" x2="17.9" y2="17.9" stroke={knockout} strokeWidth="6.4" strokeLinecap="round" />
			<line
				x1="6.1"
				y1="6.1"
				x2="17.9"
				y2="17.9"
				stroke="rgb(var(--c-primary))"
				strokeWidth="4.2"
				strokeLinecap="round"
			/>
		</svg>
	);
}

/** The mark on its tile, as on the app icon. */
export function NeurixLogo({ size = 40, className }: NeurixLogoProps) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			xmlns="http://www.w3.org/2000/svg"
			aria-label="Neurix logo"
			className={className}
			style={{ flexShrink: 0 }}
		>
			<title>Neurix</title>
			<rect width="24" height="24" rx="5.4" fill="#22211f" />
			<rect
				x="0.15"
				y="0.15"
				width="23.7"
				height="23.7"
				rx="5.25"
				fill="none"
				stroke="#ffffff"
				strokeOpacity="0.1"
				strokeWidth="0.3"
			/>
			<g transform="translate(4.2 4.2) scale(0.65)">
				<g fill="#f3efe6">
					<rect x="4" y="4" width="4.2" height="16" rx="2.1" />
					<rect x="15.8" y="4" width="4.2" height="16" rx="2.1" />
				</g>
				<line x1="6.1" y1="6.1" x2="17.9" y2="17.9" stroke="#22211f" strokeWidth="6.4" strokeLinecap="round" />
				<line x1="6.1" y1="6.1" x2="17.9" y2="17.9" stroke="#d97757" strokeWidth="4.2" strokeLinecap="round" />
			</g>
		</svg>
	);
}
