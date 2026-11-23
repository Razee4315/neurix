# Mission State

Single source of truth for resuming the Neurix autonomous mission.

## Status
- **Current Phase**: Phase 2C — Wave 3 Complete; Wave 4 Verification & Final CI Gate
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
| WAVE1-01 | Non-blocking startup, KV quant (`Q8_0`/`Q4_0`/`F16`) + Flash Attention + GPU offload fallback, prompt KV persistence, `<think>` history stripping, Air-Gap enforcement, SQLite FTS5 `FolderIndex` + `quick-xml` DOCX + PDF page hints | `e05f45a` |
| WAVE2-01 | Generated & visually verified 5 Karakoram Slate WebP illustrations (`public/assets/art/`, 4–26 KB) and regenerated all Windows/iOS/Android icons + Android system bars | `ae71fad` |
| WAVE3A-01 | Replaced Graphite/Dusk with `karakoram` default + `deodar` + upgraded `paper` + `system` matchMedia theme, bespoke WebP Illustrations, Sovereign Engine Pill + collapsible recessed Sidebar + Command Palette shortcuts | `532e380` |
| WAVE3-01 | Completed Wave 3 page redesigns & features (`3B`/`3C-1`/`3C-2`): Chat Edit-as-Branch + `< 1 / N >` Rust/TS `MessageVariant` persistence, lazy KaTeX/Mermaid + 24 highlight langs, citations, virtualization, Store/Detail/Models/Connectors/Splash/Onboarding, 2-col Character + Memory Ledger Friend editors, Tavern V2 PNG/JSON, History pins/folders/export, Engine/Air-Gap/ChatGPT+Claude import Settings, About | *(this commit)* |

## Item In Progress
- **Phase 2C (Wave 4 Verification & Final CI Gate)**: Trigger final CI build (`ci.yml` on `next`) + run comprehensive post-redesign Playwright walkthrough (`docs/mission/after/*.png`) + native Windows `neurix-tauri.exe` benchmark against real local GGUF.
- **Exact Next Step**: Push Wave 3 commit on `next`, run `gh workflow run ci.yml --ref next`, capture & visually inspect `docs/mission/after/*.png` via Playwright (`msedge`), download & benchmark CI Windows exe, restore settings backup, write `FINAL_REPORT.md` + open PR `next` -> `main`.
- **Files Touched**: `src/pages/**`, `src/pages/chat/**`, `src/utils/**`, `src/services/types.ts`, `src-tauri/src/chat/storage.rs`, `MISSION_STATE.md`

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
| 2026-11-23 13:37 | `antigravity_antigravity_viylsa` | `gemini-pro-orchestrator-neon` | Active | Unknown % (no API meter) | Healthy; zero rate-limit signals |
| 2026-11-23 13:37 | `antigravity_antigravity_ani` | `gemini-4-argon` | +Sub-Wave 3C-1 | Complete | Completed Store/Detail/Models/Connectors/Splash/Onboarding |
| 2026-11-23 13:37 | `antigravity_antigravity_ani` | `gemini-4-hydrogen` | 1 calibration + 1 research | Available reserve | Unused in Wave 3 |
| 2026-11-23 13:39 | `antigravity_antigravity_ani` | `gemini-4-neon` | +Sub-Wave 3C-2 (aborted) | Individual quota hit (`Resets in 19m54s`) | Failed cleanly on 3C-2; re-routed immediately to `codex` |
| 2026-11-23 13:45 | `claudeAgent` | `claude-opus-5-5` | +Sub-Wave 3A + 3B | Healthy | Completed 3B ChatPage, branching, KaTeX/Mermaid, citations, virtualization |
| 2026-11-23 13:55 | `codex` | `gpt-6.2-sol` / `codex exec` | +Wave 1 + 5x `image_gen` + 3C-2 re-route | Healthy | Completed re-routed 3C-2 (Editors, Tavern V2, History, Settings, About) |

## Key Decisions
- **DEC-001**: Safety tag `before-mission-2026-11-23` on `main` (`a5b7f86`); all work on `next`. See [DECISIONS.md](DECISIONS.md#dec-001-git-safety-tag--working-branch-next).
- **DEC-002**: Multi-account quota conservation & commit/push after every unit. See [DECISIONS.md](DECISIONS.md#dec-002-quota-tracking--conservative-multi-account-routing).
- **DEC-003**: Zero new automated test files; keep existing CI tests green; verify by running the app. See [DECISIONS.md](DECISIONS.md#dec-003-verification-policy-no-new-test-files-vs-keeping-existing-ci-tests-green).
- **DEC-004**: Local dev/native-baseline + GitHub Actions CI for Rust/Windows/Android builds (host lacks LLVM `libclang.dll`). See [DECISIONS.md](DECISIONS.md#dec-004-local-toolchain-vs-ci-native-build-strategy).

## Open Problems & Blocked Items
- Local host lacks `libclang.dll` (LLVM), so Rust crates depending on `llama-cpp-sys-2` compile cleanly in GitHub Actions CI (`45137177811` green) rather than locally without LLVM env.

## Running Processes & CI Runs
- Early CI Run [`45137177811`](https://github.com/Razee4315/neurix/actions/runs/45137177811) on `next` (`ae71fad`): **SUCCESS** across all 4 jobs (`Frontend`, `Windows app`, `Engine` real-model Qwen+LFM tests, `Android APK+AAB`).
