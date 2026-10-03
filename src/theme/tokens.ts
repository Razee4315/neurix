/**
 * Design tokens.
 *
 * Color roles follow Material-style naming (surface tiers, on-colors,
 * primary / secondary / tertiary). Their values come from the active theme.
 */
export const tokens = {
	// Colors resolve to CSS variables written by `applyTheme` (see themes.ts).
	// Use `alpha(color, "1f")` for translucency instead of appending hex digits.
	colors: {
		background: "rgb(var(--c-background))",
		surface: "rgb(var(--c-surface))",
		surfaceBright: "rgb(var(--c-surface-bright))",
		surfaceContainerLowest: "rgb(var(--c-surface-container-lowest))",
		surfaceContainerLow: "rgb(var(--c-surface-container-low))",
		surfaceContainer: "rgb(var(--c-surface-container))",
		surfaceContainerHigh: "rgb(var(--c-surface-container-high))",
		surfaceContainerHighest: "rgb(var(--c-surface-container-highest))",
		onSurface: "rgb(var(--c-on-surface))",
		onSurfaceVariant: "rgb(var(--c-on-surface-variant))",
		outline: "rgb(var(--c-outline))",
		outlineVariant: "rgb(var(--c-outline-variant))",
		primary: "rgb(var(--c-primary))",
		primaryDim: "rgb(var(--c-primary-dim))",
		primaryContainer: "rgb(var(--c-primary-container))",
		onPrimary: "rgb(var(--c-on-primary))",
		onPrimaryFixed: "rgb(var(--c-on-primary-fixed))",
		onPrimaryContainer: "rgb(var(--c-on-primary-container))",
		secondary: "rgb(var(--c-secondary))",
		secondaryContainer: "rgb(var(--c-secondary-container))",
		tertiary: "rgb(var(--c-tertiary))",
		error: "rgb(var(--c-error))",
		errorContainer: "rgb(var(--c-error-container))",
		onError: "rgb(var(--c-on-error))",
		scrim: "rgb(0 0 0 / 0.6)",
	},

	typography: {
		fontFamily: {
			headline: "'Space Grotesk', sans-serif",
			body: "'Inter', sans-serif",
			label: "'Inter', sans-serif",
			mono: "'JetBrains Mono', monospace",
		},
		fontSize: {
			"2xs": "0.6875rem",
			xs: "0.75rem",
			sm: "0.8125rem",
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
		ambient: "0 0 32px rgb(var(--c-primary) / 0.06)",
		elevated: "0 4px 20px rgba(0, 0, 0, 0.3)",
		nav: "0 -4px 20px rgba(0, 0, 0, 0.5)",
		glow: {
			primary: "0 0 20px rgb(var(--c-primary) / 0.2)",
			primaryStrong: "0 0 40px rgb(var(--c-primary) / 0.15)",
			secondary: "0 0 20px rgb(var(--c-secondary) / 0.2)",
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
		overlay: 900,
		sheet: 930,
		sheetTop: 940,
		modal: 1000,
		toast: 1100,
	},
} as const;

export type Tokens = typeof tokens;
