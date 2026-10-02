# Audit implementation progress

Branch: `audit/full-implementation`. Status values: `verified` / `verified*` / `blocked`.

- **verified** — implemented; type check, lint and unit tests pass; the flow was exercised in a browser.
- **verified\*** — the user-facing half is verified as above, but the fix also has a Rust half that has **not been compiled** (see below).
- **blocked** — implemented in Rust only, or needs a real device / model, so it could not be verified here. The reason is in the last column.

## Read this first: what "verified" does and does not cover

1. **No Rust toolchain was available** on the machine this run happened on (`cargo` and `rustc` are not installed). Every change under `src-tauri/` was written carefully but never compiled or run. Before anything else, run:

   ```bash
   cd src-tauri && cargo check && cargo test
   ```

   The frontend now calls backend commands that only exist in this uncompiled code (`patch_settings`, `reset_settings`, `unload_model`, `search_conversations`, `get_partial_downloads`, `get_device_info`, `export_data`, `import_data`; `get_active_model` returns `{ id, name }`). The app will not work until the Rust side builds.

2. **Browser verification ran against a mock backend** (`src/dev/mockTauri.ts`), not the real one and not a real model. It proves the UI logic, state handling and layout. It does not prove inference, downloads, file IO or Android behaviour.

3. Nothing was tested on a physical Android device or in a Windows Tauri build.

## Findings

| ID | Tier | Summary | Status | How verified / why blocked |
|---|---|---|---|---|
| F-01 | 1 | Auto-save uses stale closure | verified | Two exchanges → one conversation id, 2 then 4 messages; survives relaunch |
| F-02 | 1 | Weights reloaded on every message | blocked | Old weights are now dropped before the reload (halves peak RAM). Removing the reload itself needs candle's KV-cache behaviour tested with a real model; not attempted blind |
| F-03 | 1 | Active model not synced after launch | verified* | After relaunch the header shows the loaded model; `load_model` early-return is Rust |
| F-04 | 1 | History pairing breaks after delete / error | verified | Unit tests; in browser, deleting a reply still sent the later pair as context |
| F-05 | 1 | Unmount save duplicates chat, ignores toggle | verified | Code path reuses conversation id and `save_history`; stop-then-leave saved one conversation |
| F-06 | 1 | Message actions unreachable without touch | verified | Desktop: row occupies space, opacity 1 on keyboard focus; touch: long-press |
| F-07 | 1 | Forced auto-scroll while streaming | verified | Scrolled up mid-reply: position held, "Follow reply" appeared and returned to the bottom |
| F-08 | 1 | Load failure navigates away, loses input | verified | Forced load failure: stayed on `/chat`, overlay with retry, text kept, retry sent it |
| F-09 | 1 | Model lost from state on inference error | blocked | Rust only (`chat_cmds.rs` returns the model on every path) |
| F-10 | 1 | "User:" stop sequences truncate replies | verified* | Unit tests for the frontend cleaner; `user: admin` survived in a rendered reply. Engine stop-list + its tests are Rust |
| F-11 | 1 | Stale completion lands in new chat | verified | New chat mid-generation: empty chat stayed empty, nothing saved |
| F-12 | 1 | Input disabled while generating; no newline on touch | verified | Textarea enabled during generation; Enter sends on desktop, inserts newline on touch-primary |
| F-13 | 1 | No "cut off" indicator / Continue | verified* | Forced `length` stop: notice + Continue; continuation appended to the same message. Stop reasons and prefix continuation are Rust |
| F-14 | 1 | Markdown gaps; re-parse per token | verified | Links, table, quote, nested list, code header rendered; stream flushes once per frame |
| F-15 | 1 | Copy / share feedback not truthful | verified | Copy awaits the clipboard; share fallback toasts result |
| F-16 | 1 | Timestamps and model id rewritten on save | verified* | Unit test for timestamp round trip; saved conversation has real `model_id`. `created_at` preservation is Rust |
| F-17 | 1 | Reply label ignores character name | verified | Bubbles labelled "Default" / "Tutor" |
| F-18 | 1 | No reduced-motion support | verified | Global `prefers-reduced-motion` rule in `GlobalStyles` |
| F-19 | 1 | `100dvh` overridden by `100vh` | verified | Order fixed in `index.css`, layout, splash, boot and error screens |
| F-20 | 1 | Suspense fallback re-runs boot logic | verified | Fallback is `BootScreen` (no effects) |
| F-21 | 2 | Settings lost updates | verified* | UI sends partial patches only; toggles + character switch kept each other's values. Merge-under-lock is Rust |
| F-22 | 2 | `last_used_at` dropped by backend | blocked | Rust struct field added; ordering logic unchanged |
| F-23 | 2 | Coachmark promises model switch | verified | The sheet now has a Model section; switching loads the model |
| F-24 | 2 | History search is title-only | verified* | Search for a word that only appears in a message returned the chat with a snippet. Real search is Rust (+ unit tests there) |
| F-25 | 2 | History has no error states | verified | Forced failure: error state with retry; retry recovered |
| F-26 | 2 | Opening a chat doesn't restore its character | verified | Opened a Tutor chat while Default was active → Tutor, no toast |
| F-27 | 2 | Keyboard access: rows, cards, focus trap | verified | Rows are buttons; 0 nested buttons in the sheet; focus stays inside sheet and dialog |
| F-28 | 2 | No back control; no active tab on sub-pages | verified | Back button on History / About / editor / detail / download; nav highlights owner tab |
| F-29 | 3 | WiFi-only blocks desktop; reason hidden | verified* | Desktop UA with WiFi-only on: download ran. Mobile UA: paused with the reason shown. Backend exemption (`cfg!(mobile)`) is Rust |
| F-30 | 3 | Tokenizer failure reported as success | blocked | UI path verified with a forced failure (shown as failed, not installed, retry finishes). The real fix is Rust |
| F-31 | 3 | Deleting active model leaves it loaded | blocked | Rust (`delete_model` unloads first). UI copy and refresh verified |
| F-32 | 3 | Background download claim; notification unused | blocked | Copy is now honest ("Keep Neurix open…") and the progress notification is wired. A real Android foreground service was not built: it needs native code and a device |
| F-33 | 3 | Cancel copy vs kept partial file | verified* | Cancel dialog states what is deleted; partial list empty afterwards. Deletion itself is Rust |
| F-34 | 3 | HTTP 416, no timeouts, average speed | blocked | Rust only |
| F-35 | 3 | Fake "Downloading 0%"; no rehydration | verified* | Page without a download shows "Not downloading"; interrupted downloads return as paused. Listing partials is Rust |
| F-36 | 3 | IPC polling on every progress tick | verified | 0 backend calls during 3 s of an active download (was ~7 per second) |
| F-37 | 3 | Settings toggles: no rollback / feedback | verified | Forced write failure: toggle snapped back, toast shown, stored value unchanged |
| F-38 | 3 | Settings rows not keyboard reachable | verified | Rows are `<button>` elements |
| F-39 | 3 | Unvalidated model id in delete / load | blocked | Rust only |
| F-40 | 3 | Character limits defined three ways | verified* | One `LIMITS` module for editor + import (unit tests). Backend reply-length clamp is Rust |
| F-41 | 3 | Editor: no cancel, no dirty guard, missing id | verified | Cancel + "Discard changes?" prompt; unknown id redirects to chat |
| F-42 | 3 | First-run friction; permission timing | verified | Download → model loads → chat opens; permission asked at download start |
| F-43 | 3 | Corrupt settings file has no recovery | blocked | Rust only (+ unit test there). UI shows an error card with retry if settings fail to load |
| F-44 | 3 | `navigate()` during render | verified | Replaced with `<Navigate>` |
| F-45 | 3 | Toast a11y / padding; Models loading state | verified | Live region always mounted; `max()` padding; loading and error states |
| F-46 | 4 | About only reachable via version text | verified | "About Neurix" row in Settings; back returns to Settings |
| F-47 | 4 | Gemma 2 uses Gemma 3 loader | blocked | Needs a device and the model file to test; left unchanged |
| F-48 | 4 | Progress notification / rehydration unwired | verified* | Both are now called; real notifications need a device |
| F-49 | 4 | `font_size` setting unused | verified | Now drives the text-size control (four sizes) |
| F-50 | 4 | README / version fallback stale | verified | README and architecture doc updated; fallback is "dev". Screenshots still show the old UI (need a device to retake) |

## Missing must-haves

| ID | Summary | Status | How verified / why blocked |
|---|---|---|---|
| M-01 | Device-fit (RAM) check before download | verified* | Warning on store cards, detail page and confirm dialog. RAM comes from `/proc/meminfo` (Rust, Android/Linux); on Windows it reports unknown and no warning is shown |
| M-02 | Download integrity (checksum) | blocked | Rust only. SHA-256 is checked when HuggingFace sends the content hash in `X-Linked-ETag` / `ETag`; whether it does on the final redirected response needs a real download to confirm |
| M-03 | "Cut off" + Continue | verified* | See F-13 |
| M-04 | Draft persistence | verified | Draft survived leaving and returning to Chat |
| M-05 | Undo for message / conversation delete | verified | Both restore from the toast |
| M-06 | Full-text history search | verified* | See F-24 |
| M-07 | Model switch from chat | verified | Model section in the header sheet |
| M-08 | Back button / desktop layout | verified | Back button; chat column and sheets are width-capped and centred on wide windows |
| M-09 | Export / import all data | verified* | Export then import round-tripped 2 chats and 1 character in the mock. Real file dialogs and the Rust commands are untested |
| M-10 | Unload model | verified* | "Unload" on the active model card; command is Rust |
| M-11 | Font size + themes | verified | 10 themes, 4 text sizes; unit tests check every theme for WCAG AA contrast |
| M-12 | Onboarding shown once | verified* | Finish / skip sets `onboarding_done`; launch skips straight to the store. Field is Rust |

## Redesign

| ID | Summary | Status | How verified / why blocked |
|---|---|---|---|
| D-01 | Theme system + theme set + picker | verified | Switched themes live in the browser (dark and light); theme applied before first paint on reload |
| D-02 | SVG icon set replacing the icon font | verified | All screens render with `lucide-react` icons; stored icon names still resolve |
| D-03 | SVG illustrations | verified | Mountain scene (splash), character orb (chat), empty-state art, theme previews |

## Cleanup

| ID | Summary | Status | How verified / why blocked |
|---|---|---|---|
| C-01 | Remove unused Rust crates and dead Rust items | blocked | Needs `cargo check` |
| C-02 | Remove unused plugins, npm packages, capabilities | verified* | npm side builds and runs; Rust plugin removal and capability file need `cargo check` |
| C-03 | Remove unused components / barrels / dead branches | verified | Build, type check and lint pass |
| C-04 | Remove stale config | verified | Build passes |
| C-05 | Extract shared helpers and components | verified | `format`, `platform`, `useCatalogModel`, `useFocusTrap`, `LoadingOverlay`, chat modules |
| C-06 | Discriminated event types; z-index tokens | verified | No casts remain; type check passes |
| C-07 | CI: lint, tests, cargo test, clippy | blocked | Workflow edited but cannot run locally; clippy reports without failing |
| C-08 | Release log level | blocked | Rust only |

## Optimizations

| ID | Summary | Status | How verified / why blocked |
|---|---|---|---|
| O-01 | No per-message weight reload | blocked | See F-02 |
| O-02 | No redundant model load at launch | verified* | See F-03 |
| O-03 | Drop icon font | verified | `dist/` 4.33 MB → 0.50 MB |
| O-04 | Drop old model before loading new | blocked | Rust only |
| O-05 | No per-tick IPC polling | verified | See F-36 |
| O-06 | Throttled streaming render | verified | One state flush per animation frame |
| O-07 | Conversation listing without full parse | blocked | Rust only |
| O-08 | Smaller binary | blocked | Needs a native build to measure |
| O-09 | No styled-components displayName in production | verified | Build passes |
| O-10 | Top-p without full vocabulary sort | blocked | Rust only |

## Numbers

| | Before (main @ 8b22b1f) | After |
|---|---|---|
| `dist/` total | 4.33 MB | 0.50 MB |
| Icon font | 3.90 MB | removed |
| JS (all chunks, uncompressed) | 381 KB | 456 KB |
| Unit tests | 24 | 52 |
| Lint rule violations (`biome lint src`) | 20 | 0 |
| Backend calls per second while downloading (Store page) | ~7 | 0 |

JS grew by 75 KB: the icon set, ten themes, illustrations and the new features. The net download is still 3.8 MB smaller.

## Decisions worth a second look

- `biome.json` turns off `a11y/useSemanticElements`. It asks for `<dialog>`, `<output>` and native radio inputs in place of ARIA roles; the custom sheets, theme cards and status regions use ARIA deliberately.
- Deleting a conversation no longer asks first; it deletes and offers Undo.
- `PLAY_STORE_LISTING.md` and `PRIVACY_POLICY.md` still mention a "system prompt" setting. Store copy is yours to word, so it was left alone.
- `src-tauri/gen/android/tauri.settings.gradle` still lists the removed shell plugin. The Tauri CLI regenerates this file on the next Android build.
