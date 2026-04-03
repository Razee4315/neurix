/**
 * Design Tokens — Neurix "Obsidian Pulse" Design System
 *
 * Primary: #8ff5ff (Electric Blue) — AI "Flow State"
 * Secondary: #2ff801 (Cyber Green) — Security, Privacy, Success
 * Tertiary: #65afff (Hyper Link) — System actions, metadata
 * Background: #0e0e0f (Obsidian void)
 *
 * Philosophy: "The Stealth Laboratory" — bespoke, sovereign tech aesthetic.
 * No borders. Tonal layering only. Glow > shadow. Breathe > crowd.
 */
export const tokens = {
	colors: {
		// === PRIMARY (Electric Blue — AI Flow State) ===
		primary: "#8ff5ff",
		primaryDim: "#00deec",
		primaryContainer: "#00eefc",
		onPrimary: "#005d63",
		onPrimaryFixed: "#003f43",
		onPrimaryContainer: "#005359",
		onPrimaryFixedVariant: "#005e64",
		inversePrimary: "#006a71",

		// === SECONDARY (Cyber Green — Security / Privacy) ===
		secondary: "#2ff801",
		secondaryDim: "#2be800",
		secondaryContainer: "#106e00",
		onSecondary: "#0b5800",
		onSecondaryFixed: "#064200",
		onSecondaryContainer: "#e7ffd9",
		onSecondaryFixedVariant: "#0d6200",

		// === TERTIARY (Hyper Link — System Actions) ===
		tertiary: "#65afff",
		tertiaryDim: "#4aa2f9",
		tertiaryContainer: "#4aa2f9",
		onTertiary: "#002e52",
		onTertiaryFixed: "#001930",
		onTertiaryContainer: "#00213e",
		onTertiaryFixedVariant: "#003b68",

		// === ERROR ===
		error: "#ff716c",
		errorDim: "#d7383b",
		errorContainer: "#9f0519",
		onError: "#490006",
		onErrorContainer: "#ffa8a3",

		// === SURFACES (Obsidian Tonal Layering) ===
		background: "#0e0e0f",
		surface: "#0e0e0f",
		surfaceDim: "#0e0e0f",
		surfaceBright: "#2c2c2d",
		surfaceContainerLowest: "#000000",
		surfaceContainerLow: "#131314",
		surfaceContainer: "#1a191b",
		surfaceContainerHigh: "#201f21",
		surfaceContainerHighest: "#262627",
		surfaceVariant: "#262627",
		surfaceTint: "#8ff5ff",

		// === ON-COLORS ===
		onBackground: "#ffffff",
		onSurface: "#ffffff",
		onSurfaceVariant: "#adaaab",
		inverseSurface: "#fcf8f9",
		inverseOnSurface: "#565556",

		// === OUTLINE ===
		outline: "#767576",
		outlineVariant: "#484849",
	},

	typography: {
		fontFamily: {
			headline: "'Space Grotesk', sans-serif",
			body: "'Inter', sans-serif",
			label: "'Inter', sans-serif",
			mono: "'JetBrains Mono', monospace",
		},
		fontSize: {
			"2xs": "0.625rem",
			xs: "0.6875rem",
			sm: "0.75rem",
			base: "0.875rem",
			md: "1rem",
			lg: "1.125rem",
			xl: "1.25rem",
			"2xl": "1.5rem",
			"3xl": "1.875rem",
			"4xl": "2.25rem",
			"5xl": "3rem",
			display: "3.5rem",
		},
		fontWeight: {
			light: 300,
			regular: 400,
			medium: 500,
			semibold: 600,
			bold: 700,
			extrabold: 800,
		},
		lineHeight: {
			none: 1,
			tight: 1.1,
			snug: 1.25,
			normal: 1.5,
			relaxed: 1.625,
		},
		letterSpacing: {
			tighter: "-0.02em",
			tight: "-0.01em",
			normal: "0",
			wide: "0.05em",
			wider: "0.15em",
			widest: "0.2em",
		},
	},

	spacing: {
		xs: "0.25rem",
		sm: "0.5rem",
		md: "1rem",
		lg: "1.5rem",
		xl: "2rem",
		"2xl": "3rem",
		"3xl": "4rem",
	},

	borderRadius: {
		none: "0",
		sm: "0.125rem",
		md: "0.25rem",
		lg: "0.5rem",
		xl: "0.75rem",
		circle: "9999px",
	},

	shadows: {
		none: "none",
		ambient: "0 0 32px rgba(143, 245, 255, 0.06)",
		elevated: "0 4px 20px rgba(0, 0, 0, 0.3)",
		nav: "0 -4px 20px rgba(0, 0, 0, 0.5)",
		glow: {
			primary: "0 0 20px rgba(143, 245, 255, 0.2)",
			primaryStrong: "0 0 40px rgba(143, 245, 255, 0.15)",
			secondary: "0 0 20px rgba(47, 248, 1, 0.2)",
		},
	},

	transitions: {
		fast: "150ms cubic-bezier(0.4, 0, 0.2, 1)",
		normal: "200ms cubic-bezier(0.4, 0, 0.2, 1)",
		slow: "300ms cubic-bezier(0.4, 0, 0.2, 1)",
	},

	animation: {
		easing: {
			standard: "cubic-bezier(0.4, 0, 0.2, 1)",
			enter: "cubic-bezier(0, 0, 0.2, 1)",
			exit: "cubic-bezier(0.4, 0, 1, 1)",
		},
	},

	zIndex: {
		base: 0,
		content: 10,
		input: 30,
		nav: 50,
		overlay: 100,
		modal: 200,
		toast: 300,
	},
} as const;

export type Tokens = typeof tokens;
