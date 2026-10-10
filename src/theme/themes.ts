/**
 * Themes.
 *
 * A theme is more than a palette. Each one sets the colors, the typefaces,
 * how round the corners are, what sits behind the content, the texture laid
 * over it, how much things glow, and the weight of the icons — so switching
 * theme changes how the app feels, not only what color it is.
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
	/** Strength of glow shadows: 0 is flat, 1 is the default. */
	glow: number;
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
const GROTESK = "'Space Grotesk', 'Inter', sans-serif";
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
		// Neon on black glass: the signature look. Geometric headlines, a
		// faint dot grid and a wash of light from the top edge.
		id: "obsidian",
		name: "Obsidian",
		tagline: "Neon on black glass",
		mode: "dark",
		colors: {
			background: "#0e0e0f",
			surface: "#0e0e0f",
			surfaceBright: "#2c2c2d",
			surfaceContainerLowest: "#000000",
			surfaceContainerLow: "#131314",
			surfaceContainer: "#1a191b",
			surfaceContainerHigh: "#201f21",
			surfaceContainerHighest: "#262627",
			onSurface: "#ffffff",
			onSurfaceVariant: "#adaaab",
			outline: "#767576",
			outlineVariant: "#484849",
			primary: "#8ff5ff",
			primaryDim: "#00deec",
			primaryContainer: "#00eefc",
			onPrimary: "#005d63",
			onPrimaryFixed: "#003f43",
			onPrimaryContainer: "#005359",
			secondary: "#2ff801",
			secondaryContainer: "#106e00",
			tertiary: "#65afff",
			error: "#ff716c",
			errorContainer: "#9f0519",
			onError: "#ffffff",
		},
		style: {
			fonts: { headline: GROTESK, body: SANS, label: SANS },
			radius: { sm: "0.125rem", md: "0.25rem", lg: "0.5rem", xl: "0.75rem", pill: "9999px" },
			backdrop:
				"radial-gradient(ellipse 90% 42% at 50% -12%, rgb(var(--c-primary) / 0.11), transparent 70%) no-repeat, " +
				"radial-gradient(circle at 1px 1px, rgb(var(--c-on-surface) / 0.055) 1px, transparent 1.5px) 0 0 / 22px 22px",
			overlay: "none",
			overlayOpacity: 0,
			glow: 1,
			headlineTracking: "-0.01em",
			icons: { regular: "duotone", small: "bold" },
		},
	},
	{
		// Ink on paper: a book. Serif text, warm stock with visible grain,
		// crisp corners, no glow anywhere.
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
			secondary: "#2f6b3c",
			secondaryContainer: "#d5e8d2",
			tertiary: "#1f4e8c",
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
			glow: 0,
			headlineTracking: "-0.015em",
			icons: { regular: "light", small: "regular" },
		},
	},
	{
		// A green-screen terminal: one typeface, square corners, scanlines
		// and phosphor bloom.
		id: "phosphor",
		name: "Phosphor",
		tagline: "Green-screen terminal",
		mode: "dark",
		colors: {
			background: "#020503",
			surface: "#020503",
			surfaceBright: "#1c2a1e",
			surfaceContainerLowest: "#000000",
			surfaceContainerLow: "#07100a",
			surfaceContainer: "#0b160e",
			surfaceContainerHigh: "#102014",
			surfaceContainerHighest: "#172b1b",
			onSurface: "#c8ffd2",
			onSurfaceVariant: "#7fbf8a",
			outline: "#4f7d57",
			outlineVariant: "#25402b",
			primary: "#39ff6a",
			primaryDim: "#1fd650",
			primaryContainer: "#39ff6a",
			onPrimary: "#002b0c",
			onPrimaryFixed: "#00210a",
			onPrimaryContainer: "#002b0c",
			secondary: "#ffb000",
			secondaryContainer: "#5c3f00",
			tertiary: "#5ce1e6",
			error: "#ff5f56",
			errorContainer: "#7a1410",
			onError: "#ffffff",
		},
		style: {
			fonts: { headline: MONO, body: MONO, label: MONO },
			radius: { sm: "0", md: "0", lg: "0", xl: "0", pill: "2px" },
			backdrop: "radial-gradient(ellipse at center, transparent 55%, rgb(0 0 0 / 0.6) 100%) no-repeat",
			overlay:
				"repeating-linear-gradient(to bottom, rgb(0 0 0 / 0.3) 0, rgb(0 0 0 / 0.3) 1px, transparent 1px, transparent 3px)",
			overlayOpacity: 1,
			glow: 1.6,
			headlineTracking: "0.02em",
			icons: { regular: "bold", small: "bold" },
		},
	},
	{
		// The last light on the mountains: plum sky, apricot glow, soft round
		// shapes and filled icons.
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
			tertiary: "#7fd6c2",
			error: "#ff8a8a",
			errorContainer: "#7a1f2e",
			onError: "#ffffff",
		},
		style: {
			fonts: { headline: SANS, body: SANS, label: SANS },
			radius: { sm: "0.5rem", md: "0.75rem", lg: "1rem", xl: "1.5rem", pill: "9999px" },
			backdrop:
				"radial-gradient(62% 46% at 88% 0%, rgb(var(--c-primary) / 0.24), transparent 70%) no-repeat, " +
				"radial-gradient(58% 42% at 0% 100%, rgb(var(--c-secondary) / 0.2), transparent 70%) no-repeat",
			overlay: grain("1", 0.5),
			overlayOpacity: 0.07,
			glow: 0.55,
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
		"--glow": String(style.glow),
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
