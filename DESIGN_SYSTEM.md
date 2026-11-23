# Neurix Design System (`Karakoram Slate` & Multi-Theme Specification)

> **Foundations:** Built on **Design Direction 1 (*Karakoram Slate*)** as default dark mode, pairing cleanly with **Paper** (daylight archival study), **Deodar** (warm alpine obsidian + juniper ink), and **Phosphor** (high-contrast monochrome amber CRT), plus **`System` Auto** (`prefers-color-scheme` -> `Karakoram Slate` / `Paper`).

---

## 1. Visual Identity & Anti-Claude Guardrails

- **No Anthropic Visual DNA:** Retire warm clay `#262624` + `#d97757` across default dark mode, app logo tiles, and welcome screens.
- **Plane Separation (Linear / Apple HIG / Fluent 2):**
  1. **Navigation Plane (`surfaceContainerLow` / Sidebar):** Recessed darker neutral (`#0f1317`) holding navigation, pinned/recent threads, and the sovereign **Local Engine Pill**.
  2. **Reading Plane (`background` / Main Canvas):** Slightly lifted matte slate (`#151a20`) holding `68ch` editorial chat transcripts and clean content views.
  3. **Elevated Controls (`surfaceContainer` / `High` / Popovers):** `1px` crisp mineral hairlines (`outlineVariant`), `0px` decorative drop-shadow glow.

---

## 2. Exact Verified Color Palettes (All Pairs `>= 4.5:1` WCAG AA)

Measured contrast against [theme.test.ts](src/theme/theme.test.ts) invariants (`onSurface/bg`, `onSurfaceVariant/surfaceContainerHigh`, `primary/bg`, `onPrimaryFixed/primary`, `error/bg`):

| Token Role | `karakoram` *(Default Dark)* | `paper` *(Archival Light)* | `deodar` *(Warm Study Dark)* | `phosphor` *(Amber CRT Dark)* |
|---|---|---|---|---|
| `background` / `surface` | `#151a20` | `#f8f5ee` | `#161614` | `#050402` |
| `surfaceBright` | `#2b3440` | `#ffffff` | `#34322d` | `#2e2412` |
| `surfaceContainerLowest` | `#0a0d10` | `#fffdf9` | `#0d0d0c` | `#000000` |
| `surfaceContainerLow` *(Sidebar)* | `#0f1317` | `#efece4` | `#10100f` | `#0d0a04` |
| `surfaceContainer` | `#1a2028` | `#ebe5d9` | `#1f1e1b` | `#141006` |
| `surfaceContainerHigh` | `#212832` | `#e4ded1` | `#282622` | `#1d1709` |
| `surfaceContainerHighest` | `#29323e` | `#d8d0c0` | `#322f2a` | `#281f0c` |
| `onSurface` | `#eef3f8` *(15.67:1)* | `#1a1e1c` *(15.47:1)* | `#f4efe6` *(15.82:1)* | `#ffe9c2` *(17.26:1)* |
| `onSurfaceVariant` | `#9baabb` *(6.27:1)* | `#4c544e` *(5.83:1)* | `#afa79a` *(6.34:1)* | `#c9a868` *(7.88:1)* |
| `outline` | `#6b7a8c` | `#7d827a` | `#7b7469` | `#8a6f3a` |
| `outlineVariant` | `#2c3643` | `#cbc3b2` | `#3a3731` | `#3f3115` |
| `primary` | `#2ec4b6` *(8.07:1)* | `#226b52` *(5.86:1)* | `#4ca884` *(6.25:1)* | `#ffb000` *(11.19:1)* |
| `primaryDim` | `#20a396` | `#195440` | `#3a8a6b` | `#e09a00` |
| `primaryContainer` | `#2ec4b6` | `#226b52` | `#4ca884` | `#ffb000` |
| `onPrimary` | `#081416` | `#ffffff` | `#0b1913` | `#2b1a00` |
| `onPrimaryFixed` | `#081416` *(8.63:1)* | `#ffffff` *(6.38:1)* | `#0b1913` *(6.23:1)* | `#2b1a00` *(9.17:1)* |
| `onPrimaryContainer` | `#081416` | `#ffffff` | `#0b1913` | `#2b1a00` |
| `secondary` | `#e0a458` | `#1f4e8c` | `#d4a359` | `#ffe08a` |
| `secondaryContainer` | `#3a2d1b` | `#d6e2f3` | `#40321c` | `#5c4300` |
| `tertiary` | `#6ea8fe` | `#7a5318` | `#86b8d9` | `#ff7a45` |
| `error` | `#f27474` *(6.27:1)* | `#b3261e` *(6.00:1)* | `#ef7a6a` *(6.61:1)* | `#ff5f56` *(6.85:1)* |
| `errorContainer` | `#5a1f24` | `#f6d6d1` | `#5c201a` | `#7a1410` |
| `onError` | `#ffffff` | `#ffffff` | `#ffffff` | `#ffffff` |

### Theme Structural Signatures (`theme.test.ts` uniqueness preserved)

| Theme ID | Display Headline Font | Body Font | `radius.lg` | Backdrop / Overlay | Icon Weight |
|---|---|---|---|---|---|
| `karakoram` | `'Space Grotesk', 'Inter', system-ui, sans-serif` | System/Inter UI stack | `0.625rem` (`10px`) | Subtle Karakoram zenith glow (`rgb(46 196 182 / 0.05)`) / `none` | `regular` |
| `paper` | Serif (`Iowan Old Style` / `Georgia` / `Noto Serif`) | Serif stack | `3px` | `none` / `grain("0", 0.55)` | `light` |
| `deodar` | `'Inter', system-ui, sans-serif` | `'Inter', system-ui, sans-serif` | `1rem` (`16px`) | `none` / `grain("1", 0.5)` | `fill` |
| `phosphor` | `'JetBrains Mono', monospace` | Mono stack | `0` | Vignette / CRT scanlines | `bold` |

---

## 3. Typography, Spacing & Radius Geometry

- **Bundled Fonts (`public/` / CSS):** `Space Grotesk` (display headings), `Inter` (clean sans body & controls), `JetBrains Mono` (`tabular-nums` on `tok/s`, context token ratios, RAM/VRAM bytes, quantizations, code blocks).
- **Readable Measure:** Prose column constrained to `min(68ch, 100%)`; code blocks & tables expand cleanly to `48rem` (`768px`) max.
- **Font Scale Steps (explicitly labeled in Settings):** `Small (0.9x / 14.4px)`, `Default (1.0x / 16px)`, `Large (1.12x / 17.9px)`, `XL (1.25x / 20px)`.
- **Concentric Radii Rule:** Parent card padding + child button radius = parent card radius (e.g., `16px` composer container + `8px` padding -> `8px–10px` inner pill radius; `0px` on `Phosphor`).
- **4px Rhythm:** Tight (`4px`), compact (`8px`), card gap (`12px`), standard padding (`16px`), section gap (`24px`), hero breathing room (`32px–48px`).

---

## 4. Platform Chrome & Adaptive Ergonomics

- **Windows 11 Desktop (`>= 900px`):**
  - Integrated custom title bar (`38px–42px` high) extending sidebar (`248px`) and main reading surface cleanly to top edge, reserving top-right `138px` for Windows Minimize / Maximize / Close controls (`data-tauri-drag-region` across open chrome).
  - Lower `minWidth` compatibility cleanly supporting split-screen Snap (`>= 340px` readable without horizontal scrollbar).
- **Android & Narrow Viewports (`< 900px` / coarse pointer):**
  - Full `env(safe-area-inset-top / bottom / left / right)` coverage with single-layer inset ownership.
  - Bottom navigation bar (`5` tabs: `Chat`, `Models`, `Store`, `Connect`, `Settings`) with `>= 44x44px` touch targets.
  - Composer toolbar enforces `flex-wrap` or compact icon-only badges under `< 480px` with zero truncated inline warnings colliding into `MemoryRing`.
  - Interactive pickers (Character/Model/Settings) slide up cleanly as full-width bottom sheets within thumb reach.
