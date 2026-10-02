/**
 * Theme definitions.
 *
 * Every theme supplies the same set of color roles as hex values. At runtime
 * `applyTheme` writes them to `:root` as space-separated RGB triplets
 * (`--c-primary: 143 245 255`) so that `tokens.colors.*` can stay static
 * strings (`rgb(var(--c-primary))`) and still accept an alpha channel.
 */

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

export interface ThemeDefinition {
	id: string;
	name: string;
	tagline: string;
	mode: ThemeMode;
	colors: ThemeColors;
}

export const DEFAULT_THEME_ID = "obsidian";

export const THEMES: readonly ThemeDefinition[] = [
	{
		id: "obsidian",
		name: "Obsidian Pulse",
		tagline: "Electric cyan on black glass",
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
	},
	{
		id: "aurora",
		name: "Midnight Aurora",
		tagline: "Violet light over a navy sky",
		mode: "dark",
		colors: {
			background: "#0b0d1a",
			surface: "#0b0d1a",
			surfaceBright: "#2a2e4d",
			surfaceContainerLowest: "#06070f",
			surfaceContainerLow: "#101327",
			surfaceContainer: "#151930",
			surfaceContainerHigh: "#1b203b",
			surfaceContainerHighest: "#232946",
			onSurface: "#f1f2ff",
			onSurfaceVariant: "#a7abcc",
			outline: "#6f7498",
			outlineVariant: "#3b4064",
			primary: "#b9a4ff",
			primaryDim: "#9a7dff",
			primaryContainer: "#8c6cff",
			onPrimary: "#2a1570",
			onPrimaryFixed: "#170a47",
			onPrimaryContainer: "#22105e",
			secondary: "#5ef2c4",
			secondaryContainer: "#0b5a45",
			tertiary: "#6fd3ff",
			error: "#ff7a8a",
			errorContainer: "#8f1230",
			onError: "#ffffff",
		},
	},
	{
		id: "karakoram",
		name: "Karakoram Night",
		tagline: "Glacier blue with a sunrise edge",
		mode: "dark",
		colors: {
			background: "#0c1218",
			surface: "#0c1218",
			surfaceBright: "#2b3945",
			surfaceContainerLowest: "#060a0e",
			surfaceContainerLow: "#111921",
			surfaceContainer: "#162029",
			surfaceContainerHigh: "#1c2833",
			surfaceContainerHighest: "#24323f",
			onSurface: "#eef6fb",
			onSurfaceVariant: "#9fb3c2",
			outline: "#6a7f8e",
			outlineVariant: "#3a4a57",
			primary: "#9fdcff",
			primaryDim: "#63c2f5",
			primaryContainer: "#4db6f0",
			onPrimary: "#053a57",
			onPrimaryFixed: "#03273b",
			onPrimaryContainer: "#04324b",
			secondary: "#ffb878",
			secondaryContainer: "#7a4210",
			tertiary: "#c7b8ff",
			error: "#ff7d76",
			errorContainer: "#93100f",
			onError: "#ffffff",
		},
	},
	{
		id: "deosai",
		name: "Deosai Meadow",
		tagline: "High-plateau greens and wildflower gold",
		mode: "dark",
		colors: {
			background: "#0c120d",
			surface: "#0c120d",
			surfaceBright: "#2b3a2d",
			surfaceContainerLowest: "#060a07",
			surfaceContainerLow: "#111a13",
			surfaceContainer: "#162118",
			surfaceContainerHigh: "#1c2a1f",
			surfaceContainerHighest: "#243427",
			onSurface: "#f0f8ee",
			onSurfaceVariant: "#a4b8a4",
			outline: "#6f8370",
			outlineVariant: "#3c4d3e",
			primary: "#a6f28b",
			primaryDim: "#7fdc5e",
			primaryContainer: "#6fd24c",
			onPrimary: "#12440a",
			onPrimaryFixed: "#0b2e06",
			onPrimaryContainer: "#0f3a08",
			secondary: "#ffd966",
			secondaryContainer: "#6b5200",
			tertiary: "#7fd8d0",
			error: "#ff8274",
			errorContainer: "#8f160c",
			onError: "#ffffff",
		},
	},
	{
		id: "ember",
		name: "Ember",
		tagline: "Warm coals for late nights",
		mode: "dark",
		colors: {
			background: "#140e0b",
			surface: "#140e0b",
			surfaceBright: "#40302a",
			surfaceContainerLowest: "#0b0705",
			surfaceContainerLow: "#1b130f",
			surfaceContainer: "#221813",
			surfaceContainerHigh: "#2a1e18",
			surfaceContainerHighest: "#33251e",
			onSurface: "#fff4ec",
			onSurfaceVariant: "#c4ab9d",
			outline: "#8c7568",
			outlineVariant: "#54433a",
			primary: "#ffb07a",
			primaryDim: "#ff9350",
			primaryContainer: "#ff8438",
			onPrimary: "#5a2400",
			onPrimaryFixed: "#3c1700",
			onPrimaryContainer: "#4d1e00",
			secondary: "#ffd76a",
			secondaryContainer: "#6e5400",
			tertiary: "#ff8fa3",
			error: "#ff6b6b",
			errorContainer: "#96101a",
			onError: "#ffffff",
		},
	},
	{
		id: "sakura",
		name: "Sakura Dusk",
		tagline: "Blossom pink on deep plum",
		mode: "dark",
		colors: {
			background: "#150d14",
			surface: "#150d14",
			surfaceBright: "#412d3f",
			surfaceContainerLowest: "#0b060b",
			surfaceContainerLow: "#1c121b",
			surfaceContainer: "#231722",
			surfaceContainerHigh: "#2b1d2a",
			surfaceContainerHighest: "#352433",
			onSurface: "#fff0fa",
			onSurfaceVariant: "#c7a9c0",
			outline: "#8f7389",
			outlineVariant: "#574253",
			primary: "#ffa6d6",
			primaryDim: "#ff7fc3",
			primaryContainer: "#ff6bb9",
			onPrimary: "#620b3f",
			onPrimaryFixed: "#42052a",
			onPrimaryContainer: "#540836",
			secondary: "#a9f0c8",
			secondaryContainer: "#145c38",
			tertiary: "#c9b3ff",
			error: "#ff7474",
			errorContainer: "#93101e",
			onError: "#ffffff",
		},
	},
	{
		id: "void",
		name: "Pure Black",
		tagline: "True black, minimal glow, OLED friendly",
		mode: "dark",
		colors: {
			background: "#000000",
			surface: "#000000",
			surfaceBright: "#2a2a2a",
			surfaceContainerLowest: "#000000",
			surfaceContainerLow: "#080808",
			surfaceContainer: "#0f0f0f",
			surfaceContainerHigh: "#161616",
			surfaceContainerHighest: "#1e1e1e",
			onSurface: "#f5f5f5",
			onSurfaceVariant: "#a3a3a3",
			outline: "#6b6b6b",
			outlineVariant: "#333333",
			primary: "#f5f5f5",
			primaryDim: "#d4d4d4",
			primaryContainer: "#cfcfcf",
			onPrimary: "#111111",
			onPrimaryFixed: "#000000",
			onPrimaryContainer: "#0a0a0a",
			secondary: "#7ee787",
			secondaryContainer: "#12501a",
			tertiary: "#9ecbff",
			error: "#ff7b72",
			errorContainer: "#8e1519",
			onError: "#ffffff",
		},
	},
	{
		id: "glacier",
		name: "Glacier",
		tagline: "Bright, cool daylight",
		mode: "light",
		colors: {
			background: "#f4f8fb",
			surface: "#f4f8fb",
			surfaceBright: "#d5e0e8",
			surfaceContainerLowest: "#ffffff",
			surfaceContainerLow: "#ffffff",
			surfaceContainer: "#eaf1f6",
			surfaceContainerHigh: "#e3ecf2",
			surfaceContainerHighest: "#d9e4ec",
			onSurface: "#0f1c26",
			onSurfaceVariant: "#4a5d6b",
			outline: "#7b8d9a",
			outlineVariant: "#c2d0da",
			primary: "#0b6fa4",
			primaryDim: "#0a628f",
			primaryContainer: "#2a93cc",
			onPrimary: "#ffffff",
			onPrimaryFixed: "#ffffff",
			onPrimaryContainer: "#ffffff",
			secondary: "#1b7f3b",
			secondaryContainer: "#c9f0d3",
			tertiary: "#5b4fc4",
			error: "#c0262d",
			errorContainer: "#ffd9d6",
			onError: "#ffffff",
		},
	},
	{
		id: "apricot",
		name: "Apricot Blossom",
		tagline: "Warm paper and orchard orange",
		mode: "light",
		colors: {
			background: "#fbf6ef",
			surface: "#fbf6ef",
			surfaceBright: "#e6d9c8",
			surfaceContainerLowest: "#ffffff",
			surfaceContainerLow: "#fffdf9",
			surfaceContainer: "#f4ecdf",
			surfaceContainerHigh: "#eee4d5",
			surfaceContainerHighest: "#e6dac8",
			onSurface: "#2a1d12",
			onSurfaceVariant: "#6b5645",
			outline: "#9a8572",
			outlineVariant: "#d9c9b6",
			primary: "#b8500f",
			primaryDim: "#a0450c",
			primaryContainer: "#e07a2f",
			onPrimary: "#ffffff",
			onPrimaryFixed: "#ffffff",
			onPrimaryContainer: "#ffffff",
			secondary: "#4d7c1a",
			secondaryContainer: "#dcefc4",
			tertiary: "#a23a6e",
			error: "#ba1f2a",
			errorContainer: "#ffd9d4",
			onError: "#ffffff",
		},
	},
	{
		id: "paper",
		name: "Paper",
		tagline: "Plain, quiet, high contrast",
		mode: "light",
		colors: {
			background: "#f7f7f5",
			surface: "#f7f7f5",
			surfaceBright: "#dcdcd8",
			surfaceContainerLowest: "#ffffff",
			surfaceContainerLow: "#ffffff",
			surfaceContainer: "#efefec",
			surfaceContainerHigh: "#e8e8e4",
			surfaceContainerHighest: "#dfdfda",
			onSurface: "#171717",
			onSurfaceVariant: "#555550",
			outline: "#8a8a84",
			outlineVariant: "#cfcfc9",
			primary: "#1f1f1f",
			primaryDim: "#111111",
			primaryContainer: "#3d3d3d",
			onPrimary: "#ffffff",
			onPrimaryFixed: "#ffffff",
			onPrimaryContainer: "#ffffff",
			secondary: "#1a7f37",
			secondaryContainer: "#d2f0d9",
			tertiary: "#0b5cad",
			error: "#b3261e",
			errorContainer: "#fbd9d6",
			onError: "#ffffff",
		},
	},
];

const STORAGE_KEY = "neurix.theme";

export function getTheme(id: string | null | undefined): ThemeDefinition {
	return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

function toTriplet(hex: string): string {
	const n = Number.parseInt(hex.slice(1), 16);
	return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

const kebab = (key: string) => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** Write a theme's colors to `:root` and remember the choice for next launch. */
export function applyTheme(id: string | null | undefined): ThemeDefinition {
	const theme = getTheme(id);
	const root = document.documentElement;
	for (const [key, hex] of Object.entries(theme.colors)) {
		root.style.setProperty(`--c-${kebab(key)}`, toTriplet(hex));
	}
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
