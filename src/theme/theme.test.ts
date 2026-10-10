import { describe, expect, it } from "vitest";
import { alpha } from "./alpha";
import { DEFAULT_THEME_ID, THEMES, getTheme, isFontSize, themeVariables } from "./themes";
import { tokens } from "./tokens";

describe("alpha", () => {
	it("adds an alpha channel to a theme token", () => {
		expect(alpha(tokens.colors.primary, "80")).toBe("rgb(var(--c-primary) / 0.502)");
		expect(alpha(tokens.colors.outlineVariant, "ff")).toBe("rgb(var(--c-outline-variant) / 1)");
	});

	it("appends hex alpha to plain hex colors", () => {
		expect(alpha("#ff79c6", "1f")).toBe("#ff79c61f");
	});

	it("falls back to color-mix for other color syntaxes", () => {
		expect(alpha("color-mix(in srgb, #ff79c6 58%, black)", "80")).toBe(
			"color-mix(in srgb, color-mix(in srgb, #ff79c6 58%, black) 50%, transparent)",
		);
	});
});

describe("themes", () => {
	it("has unique ids and includes the default", () => {
		const ids = THEMES.map((t) => t.id);
		expect(new Set(ids).size).toBe(ids.length);
		expect(ids).toContain(DEFAULT_THEME_ID);
	});

	it("defines every color role as a 6-digit hex", () => {
		const roles = Object.keys(THEMES[0].colors).sort();
		for (const theme of THEMES) {
			expect(Object.keys(theme.colors).sort()).toEqual(roles);
			for (const value of Object.values(theme.colors)) {
				expect(value).toMatch(/^#[0-9a-f]{6}$/);
			}
		}
	});

	it("covers every color token the app uses", () => {
		const roles = new Set(Object.keys(THEMES[0].colors));
		for (const key of Object.keys(tokens.colors)) {
			if (key === "scrim") continue; // fixed, not themed
			expect(roles.has(key)).toBe(true);
		}
	});

	it("falls back to the default for unknown ids", () => {
		expect(getTheme("does-not-exist").id).toBe(DEFAULT_THEME_ID);
		expect(getTheme(null).id).toBe(DEFAULT_THEME_ID);
	});

	it("maps themes from earlier versions to a current one", () => {
		const current = new Set(THEMES.map((t) => t.id));
		for (const retired of ["aurora", "karakoram", "deosai", "ember", "sakura", "void", "glacier", "apricot"]) {
			expect(current.has(getTheme(retired).id), retired).toBe(true);
		}
		// Light stays light: nobody should be dropped into a dark theme.
		expect(getTheme("glacier").mode).toBe("light");
		expect(getTheme("apricot").mode).toBe("light");
		expect(getTheme("paper").id).toBe("paper");
	});

	it("is a short list", () => {
		expect(THEMES.length).toBeLessThanOrEqual(4);
	});

	it("gives every theme its own character, not only its own colors", () => {
		const signature = (pick: (t: (typeof THEMES)[number]) => string) => new Set(THEMES.map(pick)).size;
		// No two themes share a headline typeface + corner shape, a backdrop
		// and texture, or an icon weight.
		expect(signature((t) => `${t.style.fonts.headline}|${t.style.radius.lg}`)).toBe(THEMES.length);
		expect(signature((t) => `${t.style.backdrop}|${t.style.overlay}`)).toBe(THEMES.length);
		expect(signature((t) => t.style.icons.regular)).toBe(THEMES.length);
	});

	it("defines the same variables for every theme", () => {
		const names = Object.keys(themeVariables(THEMES[0])).sort();
		for (const theme of THEMES) {
			const variables = themeVariables(theme);
			expect(Object.keys(variables).sort()).toEqual(names);
			for (const [name, value] of Object.entries(variables)) {
				expect(value.length, `${theme.id} ${name}`).toBeGreaterThan(0);
			}
			expect(variables["--c-primary"]).toMatch(/^\d+ \d+ \d+$/);
		}
	});

	it("keeps body text readable against the background (WCAG AA)", () => {
		const luminance = (hex: string) => {
			const channel = (i: number) => {
				const v = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
				return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
			};
			return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
		};
		const contrast = (a: string, b: string) => {
			const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
			return (hi + 0.05) / (lo + 0.05);
		};
		for (const theme of THEMES) {
			const c = theme.colors;
			expect(contrast(c.onSurface, c.background), `${theme.id} onSurface`).toBeGreaterThanOrEqual(4.5);
			expect(
				contrast(c.onSurfaceVariant, c.surfaceContainerHigh),
				`${theme.id} onSurfaceVariant`,
			).toBeGreaterThanOrEqual(4.5);
			expect(contrast(c.primary, c.background), `${theme.id} primary`).toBeGreaterThanOrEqual(4.5);
			expect(contrast(c.onPrimaryFixed, c.primary), `${theme.id} onPrimaryFixed`).toBeGreaterThanOrEqual(4.5);
			expect(contrast(c.error, c.background), `${theme.id} error`).toBeGreaterThanOrEqual(4.5);
		}
	});
});

describe("isFontSize", () => {
	it("accepts known sizes only", () => {
		expect(isFontSize("large")).toBe(true);
		expect(isFontSize("huge")).toBe(false);
		expect(isFontSize(undefined)).toBe(false);
	});
});
