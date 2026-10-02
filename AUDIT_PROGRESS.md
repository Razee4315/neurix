# Audit implementation progress

Branch: `audit/full-implementation`. Status values: `todo` / `in-progress` / `done` / `verified` / `blocked`.

**Environment limits that affect verification**

- No Rust toolchain (`cargo`, `rustc`) is installed on the machine this run happened on. Every change under `src-tauri/` is written but **not compiled**. Those items are marked `blocked (needs cargo check)` until someone runs `cargo check && cargo test` in `src-tauri/`.
- The UI is exercised in a browser against a dev-only mock of the Tauri IPC layer (`src/dev/mockTauri.ts`), not against the real backend or a real model.

## Findings

| ID | Tier | Summary | Status | How verified / why blocked |
|---|---|---|---|---|
| F-01 | 1 | Auto-save uses stale closure | todo | |
| F-02 | 1 | Weights reloaded from disk on every message | todo | |
| F-03 | 1 | Active model not synced after splash load | todo | |
| F-04 | 1 | History pairing breaks after delete / error | todo | |
| F-05 | 1 | Unmount save duplicates chat, ignores history toggle | todo | |
| F-06 | 1 | Message actions unreachable without touch | todo | |
| F-07 | 1 | Forced auto-scroll while streaming | todo | |
| F-08 | 1 | Load failure navigates away, loses input | todo | |
| F-09 | 1 | Model lost from state on inference error | todo | |
| F-10 | 1 | "User:" stop sequences truncate valid replies | todo | |
| F-11 | 1 | Stale completion lands in new chat | todo | |
| F-12 | 1 | Input disabled while generating; no newline on touch | todo | |
| F-13 | 1 | No "cut off" indicator / Continue | todo | |
| F-14 | 1 | Markdown gaps; re-parse per token | todo | |
| F-15 | 1 | Copy / share feedback not truthful | todo | |
| F-16 | 1 | Timestamps and model id rewritten on save | todo | |
| F-17 | 1 | Reply label ignores character name | todo | |
| F-18 | 1 | No reduced-motion support | todo | |
| F-19 | 1 | `100dvh` overridden by `100vh` | todo | |
| F-20 | 1 | Suspense fallback re-runs splash boot logic | todo | |
| F-21 | 2 | Settings lost updates (whole-object writes) | todo | |
| F-22 | 2 | `last_used_at` dropped by backend | todo | |
| F-23 | 2 | Coachmark promises model switch | todo | |
| F-24 | 2 | History search is title-only | todo | |
| F-25 | 2 | History has no error states | todo | |
| F-26 | 2 | Opening a chat doesn't restore its character | todo | |
| F-27 | 2 | Keyboard access: history rows, picker cards, focus trap | todo | |
| F-28 | 2 | No back control; no active tab on sub-pages | todo | |
| F-29 | 3 | WiFi-only blocks desktop downloads; reason hidden | todo | |
| F-30 | 3 | Tokenizer failure reported as success | todo | |
| F-31 | 3 | Deleting active model leaves it loaded | todo | |
| F-32 | 3 | Background download claim; progress notification unused | todo | |
| F-33 | 3 | Cancel copy vs kept partial file | todo | |
| F-34 | 3 | HTTP 416 on resume, no timeouts, average speed | todo | |
| F-35 | 3 | Fake "Downloading 0%"; no rehydration | todo | |
| F-36 | 3 | IPC polling on every progress tick | todo | |
| F-37 | 3 | Settings toggles: no rollback / feedback | todo | |
| F-38 | 3 | Settings rows not keyboard reachable | todo | |
| F-39 | 3 | Unvalidated model id in delete / load | todo | |
| F-40 | 3 | Character limits defined three ways | todo | |
| F-41 | 3 | Editor: no cancel, no dirty guard, missing id | todo | |
| F-42 | 3 | First-run friction; notification permission timing | todo | |
| F-43 | 3 | Corrupt settings file has no recovery | todo | |
| F-44 | 3 | `navigate()` during render | todo | |
| F-45 | 3 | Toast a11y / padding; Models loading state | todo | |
| F-46 | 4 | About only reachable via version text | todo | |
| F-47 | 4 | Gemma 2 uses Gemma 3 loader | todo | |
| F-48 | 4 | Progress notification / rehydration unwired | todo | |
| F-49 | 4 | `font_size` setting unused | todo | |
| F-50 | 4 | README / version fallback stale | todo | |

## Missing must-haves

| ID | Summary | Status | How verified / why blocked |
|---|---|---|---|
| M-01 | Device-fit (RAM) check before download | todo | |
| M-02 | Download integrity (checksum) | todo | |
| M-03 | "Cut off" + Continue (same as F-13) | todo | |
| M-04 | Draft persistence | todo | |
| M-05 | Undo for message / conversation delete | todo | |
| M-06 | Full-text history search (same as F-24) | todo | |
| M-07 | Model switch from chat | todo | |
| M-08 | Back button / desktop layout | todo | |
| M-09 | Export / import all data | todo | |
| M-10 | Unload model | todo | |
| M-11 | Font size + themes | todo | |
| M-12 | Onboarding shown once | todo | |

## Redesign (requested with the implementation run)

| ID | Summary | Status | How verified / why blocked |
|---|---|---|---|
| D-01 | Theme system (CSS variables) + theme set + picker | todo | |
| D-02 | SVG icon set replacing the icon font | todo | |
| D-03 | SVG illustrations (splash, onboarding, empty states) | todo | |

## Cleanup

| ID | Summary | Status | How verified / why blocked |
|---|---|---|---|
| C-01 | Remove unused Rust crates and dead Rust items | todo | |
| C-02 | Remove unused Tauri plugins, npm packages, capabilities | todo | |
| C-03 | Remove unused components / barrels / dead branches | todo | |
| C-04 | Remove stale config (proxy, env, favicon, husky, plan.md) | todo | |
| C-05 | Extract shared helpers and components | todo | |
| C-06 | Discriminated event types; z-index tokens | todo | |
| C-07 | CI: lint, tests, cargo test, clippy | todo | |
| C-08 | Release log level | todo | |

## Optimizations

| ID | Summary | Status | How verified / why blocked |
|---|---|---|---|
| O-01 | No per-message weight reload (F-02) | todo | |
| O-02 | No redundant model load at launch (F-03) | todo | |
| O-03 | Drop icon font (3.9 MB) | todo | |
| O-04 | Drop old model before loading new | todo | |
| O-05 | No per-tick IPC polling (F-36) | todo | |
| O-06 | Throttled streaming render | todo | |
| O-07 | Conversation listing without full parse | todo | |
| O-08 | Smaller binary (plugins / crates) | todo | |
| O-09 | No styled-components displayName in production | todo | |
| O-10 | Top-p without full vocabulary sort | todo | |

## Baseline (main @ 8b22b1f)

- `tsc --noEmit`: clean. `vitest run`: 24 / 24. `biome lint src`: 20 rule violations.
- `vite build`: JS 381 KB across 22 chunks; `dist/` 4.33 MB, of which the icon font is 3.90 MB.
