# Mission State

Single source of truth for resuming the Neurix autonomous mission.

## Status
- **Current Phase**: Phase 2B — Wave 3 Anti-Claude UI/UX Redesign & Features
- **Active Branch**: `next`
- **Safety Tag (`main`)**: `before-mission-2026-11-23` -> `a5b7f8667b50a135a25e280acfd6a253529b8b14` (v1.0.1)
- **App Data Backup**: Complete (`C:\Users\Saqlain\AppData\Local\neurix-mission-backup-2026-11-23\`, `settings.json` 507 B + `models-manifest.txt`)

## Done Items
| ID | Description | Commit |
|----|-------------|--------|
| INIT-01 | Tagged `main` as `before-mission-2026-11-23`, branched `next` from `main` | `a5b7f86` |
| CAL-01 | Calibrated 5 models (`claude-opus-5-5`, `gpt-6.2-sol`, `gemini-4-argon`, `gemini-4-hydrogen`, `gemini-4-neon`) and verified `npm ci`/lint/typecheck/test/build (`22` files, `272` tests, `792,450 B` dist) | `fd97419` |
| BASE-01 | Captured installed `v1.0.0` native runtime baseline (`73.8s` BootScreen block, `3,290.55 MB` settled WS) + 19 Playwright Edge screenshots (`0` console/page errors) -> `PERFORMANCE.md`, `BEHAVIOR_NOTES.md`, `UX_BASELINE.md` | `eb8b544` |
| RES-01 | Synthesized all 5 research tracks into `RESEARCH.md`, `DESIGN_RESEARCH.md` (38 refs, 5 anti-Claude moves, 3 directions), and `FEATURE_MATRIX.md` | `5f10269` |
| PLAN-01 | Locked Phase 2 architecture (`DEC-006`..`009`, `Karakoram Slate` default) and authored `BACKLOG.md`, `UI_AUDIT.md`, `DESIGN_SYSTEM.md`, `MOTION.md` | `51e5f58` |
| WAVE1-01 | Non-blocking startup, KV quant (`Q8_0`/`Q4_0`/`F16`) + Flash Attention + GPU offload fallback, prompt KV persistence, `<think>` history stripping, Air-Gap enforcement, SQLite FTS5 `FolderIndex` + `quick-xml` DOCX + PDF page hints | *(this commit)* |
| WAVE2-01 | Generated & visually verified 5 Karakoram Slate WebP illustrations (`public/assets/art/`, 4–26 KB) and regenerated all Windows/iOS/Android icons + Android system bars | *(this commit)* |

## Item In Progress
- **Phase 2B (Wave 3)**: Patch npm packages (`vite`, `react-router-dom`, `styled-components`), add `katex`/`mermaid`/`@tanstack/react-virtual`, execute Sub-Wave 3A (`claude-opus-5-5`), then parallel Sub-Waves 3B (`claude-opus-5-5`), 3C-1 (`gemini-4-argon`), 3C-2 (`gemini-4-neon`).
- **Exact Next Step**: Trigger early CI (`ci.yml` on `next`), install npm upgrades/packages, and delegate Sub-Wave 3A design system & shell redesign.
- **Files Touched**: `src-tauri/**`, `src/pages/SplashScreen.tsx`, `src/context/AppContext.tsx`, `src/pages/chat/messages.ts`, `public/assets/**`, `src-tauri/icons/**`, `MISSION_STATE.md`

## Next 5 Items in Order
1. **Wave 1**: Non-blocking startup (`< 2s`), `Q8_0`/`Q4_0` KV cache + Flash Attention + GPU offload + fallback, `<think>` history stripping, prompt KV state cache, Air-Gap lock, `rusqlite` FTS5 RAG + `quick-xml`, safe npm patches.
2. **Wave 2**: Part 7 bespoke Karakoram illustrations (`public/assets/art/`) & refreshed app icon set (`src-tauri/icons/`).
3. **Wave 2b (Early CI Gate)**: Run `gh workflow run ci.yml --ref next` and confirm Rust tests, Clippy, real-model E2E, Windows exe, and Android APK all build green.
4. **Wave 3**: Full UI/UX redesign (`Karakoram Slate`, `Paper`, `Deodar`, `Phosphor`, `System`), Edit-as-Branch (`< 1/N >`), lazy KaTeX/Mermaid, Tavern Card V2 import, long-chat virtualization, mobile overlap fix.
5. **Wave 4**: Post-redesign Playwright + real native CI artifact install verification + `FINAL_REPORT.md` + PR `next` -> `main`.

## Agent Roles (Part 1 — Calibrated 2026-11-23)
| Role | Agent (`Provider / Model`) | Calibration Score & Notes |
|---|---|---|
| **Orchestrator & Quality Gate** | `antigravity_antigravity_viylsa` / `gemini-pro-orchestrator-neon` | Active orchestrator; protected from bulk work |
| **Heavy Implementer + Lead UI** | `claudeAgent` / `claude-opus-5-5` | ~1m35s · Acc 5/5 · Code 5/5 · Inst 5/5 (zero casts, cleanest TypeScript) |
| **Heavy Implementer (Backend/Perf)** | `codex` / `gpt-6.2-sol` | ~2m02s · Acc 5/5 · Code 5/5 · Inst 5/5 (zero casts `switch`, concise) |
| **Standard Implementer (Primary)** | `antigravity_antigravity_ani` / `gemini-4-argon` | ~1m45s · Acc 5/5 · Code 4.5/5 · Inst 5/5 (`VIYLSA` Argon = overflow reserve) |
| **Standard Implementer (Secondary)** | `antigravity_antigravity_ani` / `gemini-4-hydrogen` | ~2m39s · Acc 5/5 · Code 4.8/5 · Inst 5/5 |
| **UI Implementer (Secondary)** | `antigravity_antigravity_ani` / `gemini-4-neon` | ~2m47s · Acc 5/5 · Code 4.8/5 · Inst 5/5 |
| **Researchers (5 Tracks)** | Parallel pool across all 5 calibrated models | 0 hallucinations observed in calibration |
| **Graphics (Fixed per Part 7)** | ChatGPT / Codex CLI (`codex exec` + `image_gen`) | Local CLI `codex-cli 0.171.0` |
| **Operator** | Local execution agent | Builds, git, Playwright, native measurements |

## Quota Log
*(Neither T3 Code nor local CLIs expose exact remaining %; tracking every check/call and rate-limit signal per Part 0.1.)*

| Timestamp (PKT) | Account / Provider | Model | Calls Used (Session) | Status / Estimate | Notes |
|---|---|---|---|---|---|
| 2026-11-23 13:15 | `antigravity_antigravity_viylsa` | `gemini-pro-orchestrator-neon` | Active | Unknown % (no API meter) | Healthy; zero rate-limit signals |
| 2026-11-23 13:15 | `antigravity_antigravity_ani` | `gemini-4-argon` | 1 calibration + 1 research | Unknown % | Ready for Wave 3C-1 |
| 2026-11-23 13:15 | `antigravity_antigravity_ani` | `gemini-4-hydrogen` | 1 calibration + 1 research | Unknown % | Available reserve |
| 2026-11-23 13:15 | `antigravity_antigravity_ani` | `gemini-4-neon` | 1 calibration + 1 research | Unknown % | Ready for Wave 3C-2 |
| 2026-11-23 13:15 | `claudeAgent` | `claude-opus-5-5` | 1 calibration + 1 research | Unknown % | Ready for Wave 3A & 3B |
| 2026-11-23 13:15 | `codex` | `gpt-6.2-sol` / `codex exec` | +Wave 1 impl + 5x `image_gen` | Unknown % | Completed Wave 1 (`113` Cargo tests) & Wave 2 art cleanly |

## Key Decisions
- **DEC-001**: Safety tag `before-mission-2026-11-23` on `main` (`a5b7f86`); all work on `next`. See [DECISIONS.md](DECISIONS.md#dec-001-git-safety-tag--working-branch-next).
- **DEC-002**: Multi-account quota conservation & commit/push after every unit. See [DECISIONS.md](DECISIONS.md#dec-002-quota-tracking--conservative-multi-account-routing).
- **DEC-003**: Zero new automated test files; keep existing CI tests green; verify by running the app. See [DECISIONS.md](DECISIONS.md#dec-003-verification-policy-no-new-test-files-vs-keeping-existing-ci-tests-green).
- **DEC-004**: Local dev/native-baseline + GitHub Actions CI for Rust/Windows/Android builds (host lacks LLVM `libclang.dll`). See [DECISIONS.md](DECISIONS.md#dec-004-local-toolchain-vs-ci-native-build-strategy).

## Open Problems & Blocked Items
- Local host lacks `libclang.dll` (LLVM), so Rust crates depending on `llama-cpp-sys-2` compile in GitHub Actions CI rather than locally.

## Running Processes & CI Runs
- None (all Phase 1 calibration, research, native runtime, and Playwright walkthrough tasks finished cleanly).
