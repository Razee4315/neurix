/**
 * Themes.
 *
 * A theme is more than a palette. Each one sets the colors, the typefaces,
 * how round the corners are, what sits behind the content, the texture laid
 * over it and the weight of the icons, so switching theme changes how the
 * app feels, not only what color it is. Surfaces are flat in every theme:
 * solid fills, no glows.
 *
 * At runtime `applyTheme` writes all of that to `:root` as CSS variables.
 * Colors are stored as space-separated RGB triplets (`--c-primary: 143 245
 * 255`) so `tokens.colors.*` can stay static strings
 * (`rgb(var(--c-primary))`) and still accept an alpha channel.
 */
import { type IconWeight, setIconWeights } from "./iconWeight";

export interface ThemeColors {
	background: string;
	surface: string;
	surfaceBright: string;
	surfaceContainerLowest: string;
	surfaceContainerLow: string;
	surfaceContainer: string;
	surfaceContainerHigh: string;
	surfaceContainerHighest: string;
	onSurface: string;
	onSurfaceVariant: string;
	outline: string;
	outlineVariant: string;
	primary: string;
	primaryDim: string;
	primaryContainer: string;
	onPrimary: string;
	onPrimaryFixed: string;
	onPrimaryContainer: string;
	secondary: string;
	secondaryContainer: string;
	tertiary: string;
	error: string;
	errorContainer: string;
	onError: string;
}

export type ThemeMode = "dark" | "light";

/** Everything about a theme that is not a color. */
export interface ThemeStyle {
	fonts: {
		headline: string;
		body: string;
		/** Buttons, chips and other interface labels. */
		label: string;
	};
	/** Corner radii. `pill` is used for fully rounded shapes. */
	radius: { sm: string; md: string; lg: string; xl: string; pill: string };
	/** Background layers painted behind every page, or "none". */
	backdrop: string;
	/** A texture laid over the whole interface (grain, scanlines), or "none". */
	overlay: string;
	overlayOpacity: number;
	/** Letter-spacing of headings. */
	headlineTracking: string;
	/** Icon stroke style, and the sturdier one used for small icons. */
	icons: { regular: IconWeight; small: IconWeight };
}

export interface ThemeDefinition {
	id: string;
	name: string;
	/** A few words on the mood, shown under the name in the picker. */
	tagline: string;
	mode: ThemeMode;
	colors: ThemeColors;
	style: ThemeStyle;
}

const SANS = "'Inter', system-ui, sans-serif";
// The platform's own interface face: SF Pro on macOS, Segoe UI on Windows.
const UI = "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";
// Book faces that ship with the platform: Noto Serif on Android, Palatino or
// Georgia on desktop. Nothing extra has to be bundled.
const SERIF = "'Iowan Old Style', 'Palatino Linotype', Palatino, 'Noto Serif', Georgia, serif";

/** Fine film grain as an inline SVG. `ink` is the speck color: "0" dark, "1" light. */
function grain(ink: "0" | "1", strength: number): string {
	const svg = [
		"<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'>",
		"<filter id='n'>",
		"<feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/>",
		`<feColorMatrix values='0 0 0 0 ${ink}  0 0 0 0 ${ink}  0 0 0 0 ${ink}  0 0 0 ${strength} 0'/>`,
		"</filter>",
		"<rect width='100%' height='100%' filter='url(#n)'/>",
		"</svg>",
	].join("");
	return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export const DEFAULT_THEME_ID = "obsidian";

export const THEMES: readonly ThemeDefinition[] = [
	{
		// Warm graphite with a clay accent: a calm, professional desktop look.
		// Plain sans for the interface, a book serif only for the greeting.
		id: "obsidian",
		name: "Graphite",
		tagline: "Warm graphite, clay accent",
		mode: "dark",
		colors: {
			background: "#262624",
			surface: "#262624",
			surfaceBright: "#3a3935",
			surfaceContainerLowest: "#141413",
			surfaceContainerLow: "#1f1e1d",
			surfaceContainer: "#2a2927",
			surfaceContainerHigh: "#30302e",
			surfaceContainerHighest: "#3a3935",
			onSurface: "#f5f4ef",
			onSurfaceVariant: "#a6a49b",
			outline: "#77756d",
			outlineVariant: "#45443f",
			primary: "#d97757",
			primaryDim: "#c6613f",
			primaryContainer: "#d97757",
			onPrimary: "#ffffff",
			onPrimaryFixed: "#ffffff",
			onPrimaryContainer: "#ffffff",
			secondary: "#8fb996",
			secondaryContainer: "#26402b",
			tertiary: "#8ab4f8",
			error: "#ef7a6a",
			errorContainer: "#5c201a",
			onError: "#ffffff",
		},
		style: {
			fonts: { headline: UI, body: UI, label: UI },
			radius: { sm: "0.25rem", md: "0.375rem", lg: "0.5rem", xl: "0.75rem", pill: "9999px" },
			backdrop: "none",
			overlay: "none",
			overlayOpacity: 0,
			headlineTracking: "-0.01em",
			icons: { regular: "regular", small: "regular" },
		},
	},
	{
		// Ink on paper: a book. Serif text, warm stock with visible grain and
		// crisp corners.
		id: "paper",
		name: "Paper",
		tagline: "Ink, serif and daylight",
		mode: "light",
		colors: {
			background: "#f6f1e7",
			surface: "#f6f1e7",
			surfaceBright: "#ffffff",
			surfaceContainerLowest: "#fffdf8",
			surfaceContainerLow: "#f0eadd",
			surfaceContainer: "#eae3d4",
			surfaceContainerHigh: "#e3dbca",
			surfaceContainerHighest: "#d9d0bd",
			onSurface: "#1f1a14",
			onSurfaceVariant: "#5c5346",
			outline: "#8a7f6d",
			outlineVariant: "#c9bfaa",
			primary: "#8c2f1b",
			primaryDim: "#73240f",
			primaryContainer: "#a13d27",
			onPrimary: "#ffffff",
			onPrimaryFixed: "#ffffff",
			onPrimaryContainer: "#ffffff",
			secondary: "#1f4e8c",
			secondaryContainer: "#d6e2f3",
			tertiary: "#8a5a00",
			error: "#b3261e",
			errorContainer: "#f6d6d1",
			onError: "#ffffff",
		},
		style: {
			fonts: { headline: SERIF, body: SERIF, label: SANS },
			radius: { sm: "1px", md: "2px", lg: "3px", xl: "5px", pill: "9999px" },
			backdrop: "none",
			overlay: grain("0", 0.55),
			overlayOpacity: 0.22,
			headlineTracking: "-0.015em",
			icons: { regular: "light", small: "regular" },
		},
	},
	{
		// An amber terminal: one typeface, square corners and scanlines.
		id: "phosphor",
		name: "Phosphor",
		tagline: "Amber terminal",
		mode: "dark",
		colors: {
			background: "#050402",
			surface: "#050402",
			surfaceBright: "#2e2412",
			surfaceContainerLowest: "#000000",
			surfaceContainerLow: "#0d0a04",
			surfaceContainer: "#141006",
			surfaceContainerHigh: "#1d1709",
			surfaceContainerHighest: "#281f0c",
			onSurface: "#ffe9c2",
			onSurfaceVariant: "#c9a868",
			outline: "#8a6f3a",
			outlineVariant: "#3f3115",
			primary: "#ffb000",
			primaryDim: "#e09a00",
			primaryContainer: "#ffb000",
			onPrimary: "#2b1a00",
			onPrimaryFixed: "#2b1a00",
			onPrimaryContainer: "#2b1a00",
			secondary: "#ffe08a",
			secondaryContainer: "#5c4300",
			tertiary: "#ff7a45",
			error: "#ff5f56",
			errorContainer: "#7a1410",
			onError: "#ffffff",
		},
		style: {
			fonts: { headline: MONO, body: MONO, label: MONO },
			radius: { sm: "0", md: "0", lg: "0", xl: "0", pill: "2px" },
			backdrop: "radial-gradient(ellipse at center, transparent 55%, rgb(0 0 0 / 0.6) 100%) no-repeat",
			overlay:
				"repeating-linear-gradient(to bottom, rgb(0 0 0 / 0.2) 0, rgb(0 0 0 / 0.2) 1px, transparent 1px, transparent 4px)",
			overlayOpacity: 1,
			headlineTracking: "0.02em",
			icons: { regular: "bold", small: "bold" },
		},
	},
	{
		// The last light on the mountains: a plum sky, an apricot accent,
		// soft round shapes and filled icons.
		id: "dusk",
		name: "Dusk",
		tagline: "Soft, warm and rounded",
		mode: "dark",
		colors: {
			background: "#1a1426",
			surface: "#1a1426",
			surfaceBright: "#3d3252",
			surfaceContainerLowest: "#120d1b",
			surfaceContainerLow: "#211a30",
			surfaceContainer: "#281f3a",
			surfaceContainerHigh: "#302644",
			surfaceContainerHighest: "#3a2f50",
			onSurface: "#fbf1ea",
			onSurfaceVariant: "#c4b5c9",
			outline: "#8d7d96",
			outlineVariant: "#4d4060",
			primary: "#ffb38a",
			primaryDim: "#ff9a66",
			primaryContainer: "#ff8fa3",
			onPrimary: "#5a2408",
			onPrimaryFixed: "#3b1503",
			onPrimaryContainer: "#4a1020",
			secondary: "#c7a6ff",
			secondaryContainer: "#4b2f80",
			tertiary: "#8fc7ff",
			error: "#ff8a8a",
			errorContainer: "#7a1f2e",
			onError: "#ffffff",
		},
		style: {
			fonts: { headline: SANS, body: SANS, label: SANS },
			radius: { sm: "0.5rem", md: "0.75rem", lg: "1rem", xl: "1.5rem", pill: "9999px" },
			backdrop: "none",
			overlay: grain("1", 0.5),
			overlayOpacity: 0.07,
			headlineTracking: "-0.025em",
			icons: { regular: "fill", small: "fill" },
		},
	},
];

/** Themes from earlier versions, mapped to the closest current one. */
const RETIRED: Record<string, string> = {
	aurora: "dusk",
	karakoram: "obsidian",
	deosai: "obsidian",
	ember: "dusk",
	sakura: "dusk",
	void: "phosphor",
	glacier: "paper",
	apricot: "paper",
};

const STORAGE_KEY = "neurix.theme";

export function getTheme(id: string | null | undefined): ThemeDefinition {
	const current = id ? (RETIRED[id] ?? id) : id;
	return THEMES.find((t) => t.id === current) ?? THEMES[0];
}

function toTriplet(hex: string): string {
	const n = Number.parseInt(hex.slice(1), 16);
	return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

const kebab = (key: string) => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** The CSS variables a theme sets, apart from its colors. */
export function styleVariables(style: ThemeStyle): Record<string, string> {
	return {
		"--font-headline": style.fonts.headline,
		"--font-body": style.fonts.body,
		"--font-label": style.fonts.label,
		"--radius-sm": style.radius.sm,
		"--radius-md": style.radius.md,
		"--radius-lg": style.radius.lg,
		"--radius-xl": style.radius.xl,
		"--radius-pill": style.radius.pill,
		"--backdrop": style.backdrop,
		"--overlay": style.overlay,
		"--overlay-opacity": String(style.overlayOpacity),
		"--headline-tracking": style.headlineTracking,
	};
}

/**
 * Every CSS variable a theme defines. Set on `:root` they theme the app;
 * set on any element they theme just that element's subtree, which is how
 * the picker draws each swatch in its own theme.
 */
export function themeVariables(theme: ThemeDefinition): Record<string, string> {
	const variables = styleVariables(theme.style);
	for (const [key, hex] of Object.entries(theme.colors)) {
		variables[`--c-${kebab(key)}`] = toTriplet(hex);
	}
	return variables;
}

/** Apply a theme to the page and remember the choice for next launch. */
export function applyTheme(id: string | null | undefined): ThemeDefinition {
	const theme = getTheme(id);
	const root = document.documentElement;
	for (const [name, value] of Object.entries(themeVariables(theme))) {
		root.style.setProperty(name, value);
	}
	setIconWeights(theme.style.icons.regular, theme.style.icons.small);
	root.dataset.theme = theme.id;
	root.dataset.mode = theme.mode;
	root.style.colorScheme = theme.mode;
	document
		.querySelector('meta[name="theme-color"]')
		?.setAttribute("content", theme.colors.background);
	try {
		localStorage.setItem(STORAGE_KEY, theme.id);
	} catch {
		// Storage unavailable: the theme still applies for this session.
	}
	return theme;
}

/** Theme id remembered from the previous launch, if any. */
export function storedThemeId(): string | null {
	try {
		return localStorage.getItem(STORAGE_KEY);
	} catch {
		return null;
	}
}

export const FONT_SCALES = { small: 0.9, medium: 1, large: 1.12, xlarge: 1.25 } as const;
export type FontSize = keyof typeof FONT_SCALES;

export function isFontSize(v: unknown): v is FontSize {
	return typeof v === "string" && v in FONT_SCALES;
}

/** Scale all rem-based type by changing the root font size. */
export function applyFontSize(size: string | null | undefined): void {
	const scale = isFontSize(size) ? FONT_SCALES[size] : 1;
	document.documentElement.style.fontSize = `${16 * scale}px`;
}
