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
 *
 * Besides the themes in `THEMES` there is one more choice, `"system"`, which
 * follows the operating system: Karakoram when it is dark, Paper when it is
 * light. It is a choice, not a theme, so it lives outside the list.
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
const DISPLAY = "'Space Grotesk', 'Inter', system-ui, sans-serif";
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

export const DEFAULT_THEME_ID = "karakoram";

/** The choice that follows the operating system's light or dark setting. */
export const SYSTEM_THEME_ID = "system";

/** Theme used for `"system"` when the OS is dark, and when it is light. */
export const SYSTEM_DARK_THEME_ID = "karakoram";
export const SYSTEM_LIGHT_THEME_ID = "paper";

export const THEMES: readonly ThemeDefinition[] = [
	{
		// Slate stone under a clear high-altitude sky: a recessed basalt
		// sidebar, a matte reading plane and a glacial teal accent with a
		// brass telemetry tone. Space Grotesk for display, platform UI face
		// for everything else.
		id: "karakoram",
		name: "Karakoram",
		tagline: "Slate, glacial teal, brass",
		mode: "dark",
		colors: {
			background: "#151a20",
			surface: "#151a20",
			surfaceBright: "#2b3440",
			surfaceContainerLowest: "#0a0d10",
			surfaceContainerLow: "#0f1317",
			surfaceContainer: "#1a2028",
			surfaceContainerHigh: "#212832",
			surfaceContainerHighest: "#29323e",
			onSurface: "#eef3f8",
			onSurfaceVariant: "#9baabb",
			outline: "#6b7a8c",
			outlineVariant: "#2c3643",
			primary: "#2ec4b6",
			primaryDim: "#20a396",
			primaryContainer: "#2ec4b6",
			onPrimary: "#081416",
			onPrimaryFixed: "#081416",
			onPrimaryContainer: "#081416",
			secondary: "#e0a458",
			secondaryContainer: "#3a2d1b",
			tertiary: "#6ea8fe",
			error: "#f27474",
			errorContainer: "#5a1f24",
			onError: "#ffffff",
		},
		style: {
			fonts: { headline: DISPLAY, body: UI, label: UI },
			radius: {
				sm: "0.25rem",
				md: "0.375rem",
				lg: "0.625rem",
				xl: "0.875rem",
				pill: "9999px",
			},
			backdrop: "none",
			overlay: "none",
			overlayOpacity: 0,
			headlineTracking: "-0.015em",
			icons: { regular: "regular", small: "regular" },
		},
	},
	{
		// Ink on archival paper: a book. Serif text, warm stock with visible
		// grain, crisp corners and a forest-ink accent.
		id: "paper",
		name: "Paper",
		tagline: "Ink, serif and daylight",
		mode: "light",
		colors: {
			background: "#f8f5ee",
			surface: "#f8f5ee",
			surfaceBright: "#ffffff",
			surfaceContainerLowest: "#fffdf9",
			surfaceContainerLow: "#efece4",
			surfaceContainer: "#ebe5d9",
			surfaceContainerHigh: "#e4ded1",
			surfaceContainerHighest: "#d8d0c0",
			onSurface: "#1a1e1c",
			onSurfaceVariant: "#4c544e",
			outline: "#7d827a",
			outlineVariant: "#cbc3b2",
			primary: "#226b52",
			primaryDim: "#195440",
			primaryContainer: "#226b52",
			onPrimary: "#ffffff",
			onPrimaryFixed: "#ffffff",
			onPrimaryContainer: "#ffffff",
			secondary: "#1f4e8c",
			secondaryContainer: "#d6e2f3",
			tertiary: "#7a5318",
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
		// A cedar study after dark: warm near-black, juniper ink, soft round
		// shapes and filled icons.
		id: "deodar",
		name: "Deodar",
		tagline: "Warm cedar study, juniper ink",
		mode: "dark",
		colors: {
			background: "#161614",
			surface: "#161614",
			surfaceBright: "#34322d",
			surfaceContainerLowest: "#0d0d0c",
			surfaceContainerLow: "#10100f",
			surfaceContainer: "#1f1e1b",
			surfaceContainerHigh: "#282622",
			surfaceContainerHighest: "#322f2a",
			onSurface: "#f4efe6",
			onSurfaceVariant: "#afa79a",
			outline: "#7b7469",
			outlineVariant: "#3a3731",
			primary: "#4ca884",
			primaryDim: "#3a8a6b",
			primaryContainer: "#4ca884",
			onPrimary: "#0b1913",
			onPrimaryFixed: "#0b1913",
			onPrimaryContainer: "#0b1913",
			secondary: "#d4a359",
			secondaryContainer: "#40321c",
			tertiary: "#86b8d9",
			error: "#ef7a6a",
			errorContainer: "#5c201a",
			onError: "#ffffff",
		},
		style: {
			fonts: { headline: SANS, body: SANS, label: SANS },
			radius: {
				sm: "0.5rem",
				md: "0.75rem",
				lg: "1rem",
				xl: "1.5rem",
				pill: "9999px",
			},
			backdrop: "none",
			overlay: grain("1", 0.5),
			overlayOpacity: 0.07,
			headlineTracking: "-0.025em",
			icons: { regular: "fill", small: "fill" },
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
];

/** Themes from earlier versions, mapped to the closest current one. */
const RETIRED: Record<string, string> = {
	obsidian: "karakoram",
	dusk: "deodar",
	aurora: "deodar",
	deosai: "karakoram",
	ember: "deodar",
	sakura: "deodar",
	void: "phosphor",
	glacier: "paper",
	apricot: "paper",
};

const STORAGE_KEY = "neurix.theme";

/** True for the "follow the operating system" choice. */
export function isSystemTheme(v: unknown): v is typeof SYSTEM_THEME_ID {
	return v === SYSTEM_THEME_ID;
}

/** Whether the operating system currently asks for a light interface. */
export function systemPrefersLight(): boolean {
	try {
		return window.matchMedia?.("(prefers-color-scheme: light)")?.matches ?? false;
	} catch {
		return false;
	}
}

/** The concrete theme id a stored choice stands for ("system" resolves via the OS). */
export function resolveThemeId(id: string | null | undefined): string {
	return getTheme(id).id;
}

export function getTheme(id: string | null | undefined): ThemeDefinition {
	const chosen = isSystemTheme(id)
		? systemPrefersLight()
			? SYSTEM_LIGHT_THEME_ID
			: SYSTEM_DARK_THEME_ID
		: id;
	const current = chosen ? (RETIRED[chosen] ?? chosen) : chosen;
	return THEMES.find((t) => t.id === current) ?? THEMES.find((t) => t.id === DEFAULT_THEME_ID) ?? THEMES[0];
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

/** `SystemBarsBridge` in the Android app (MainActivity.kt). */
type BarsWindow = Window & {
	NeurixBars?: { setColors(top: string, bottom: string, light: boolean): void };
};

/**
 * Apply a theme choice to the page and remember it for next launch.
 * `"system"` is remembered as `"system"` and paints the theme the OS asks
 * for right now; call again when the OS setting changes.
 */
export function applyTheme(id: string | null | undefined): ThemeDefinition {
	const followSystem = isSystemTheme(id);
	const theme = getTheme(id);
	const root = document.documentElement;
	for (const [name, value] of Object.entries(themeVariables(theme))) {
		root.style.setProperty(name, value);
	}
	setIconWeights(theme.style.icons.regular, theme.style.icons.small);
	root.dataset.theme = theme.id;
	root.dataset.themeChoice = followSystem ? SYSTEM_THEME_ID : theme.id;
	root.dataset.mode = theme.mode;
	root.style.colorScheme = theme.mode;
	document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme.colors.background);
	// Android: match the status bar to the top bar and the navigation bar to
	// the tab bar, with bar icons that stay readable on light themes.
	try {
		(window as BarsWindow).NeurixBars?.setColors(
			theme.colors.background,
			theme.colors.surfaceContainerLow,
			theme.mode === "light",
		);
	} catch {
		// Not on Android, or an older build without the bridge.
	}
	try {
		localStorage.setItem(STORAGE_KEY, followSystem ? SYSTEM_THEME_ID : theme.id);
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

export const FONT_SCALES = {
	small: 0.9,
	medium: 1,
	large: 1.12,
	xlarge: 1.25,
} as const;
export type FontSize = keyof typeof FONT_SCALES;

export function isFontSize(v: unknown): v is FontSize {
	return typeof v === "string" && v in FONT_SCALES;
}

/** Scale all rem-based type by changing the root font size. */
export function applyFontSize(size: string | null | undefined): void {
	const scale = isFontSize(size) ? FONT_SCALES[size] : 1;
	document.documentElement.style.fontSize = `${16 * scale}px`;
}
