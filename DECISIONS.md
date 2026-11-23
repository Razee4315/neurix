# Decisions Log

Architectural, operational, and product decisions made autonomously during the Neurix mission.

---

## DEC-001: Git Safety Tag & Working Branch (`next`)
- **Date**: 2026-11-23
- **Context**: `.github/workflows/release.yml` automatically bumps the patch version, creates a git tag, and publishes a public GitHub release on every push to `main` outside `website/**`.
- **Decision**: Tagged `main` (`a5b7f8667b50a135a25e280acfd6a253529b8b14`, v1.0.1) as `before-mission-2026-11-23` and pushed the tag. Branched `next` from `main` for all mission work and pushed `origin/next`.
- **Reasoning**: Keeps `main` untouched as an instant rollback point and guarantees no accidental release or tag is triggered before final PR review.

---

## DEC-002: Quota Tracking & Conservative Multi-Account Routing
- **Date**: 2026-11-23
- **Context**: T3 Code and the local CLIs (`agy`, `claude`, `codex`) do not expose live remaining quota percentages programmatically. The orchestrator is `Orchestrator (Neon)` (`gemini-pro-orchestrator-neon`) on `antigravity_antigravity_viylsa`.
- **Decision**:
  1. Treat quota on every account as finite and potentially close to exhaustion: commit and push (`MISSION_STATE.md` + `git commit` + `git push origin next`) after every verified unit of work.
  2. Log every delegate call, error, or rate-limit warning in `MISSION_STATE.md` with timestamps.
  3. Route delegate work across `claudeAgent`, `codex`, and `antigravity_antigravity_ani` first to preserve `antigravity_antigravity_viylsa` for orchestration and final review; use `antigravity_antigravity_viylsa` non-orchestrator models (`gemini-4-argon`, `gemini-4-hydrogen`) only as fallback capacity.
- **Reasoning**: Eliminates single-account exhaustion stalls and ensures at most one small unit could ever be interrupted.

---

## DEC-003: Verification Policy (No New Test Files vs Keeping Existing CI Tests Green)
- **Date**: 2026-11-23
- **Context**: `AGENTS.md` / `.github/workflows/ci.yml` run existing Vitest (`npm test`) and Rust (`cargo test`) suites; Mission Part 8 forbids writing automated test code and requires real app/UI/CLI verification.
- **Decision**: Keep all existing Vitest and Rust tests passing (updating existing tests only if an intentional contract change requires it, never deleting or relaxing assertions), and write **zero** new automated test files during this mission. Verify every backlog item by actually running and exercising the app (dev server via Playwright + native Windows `.exe` + CI build installed locally).
- **Reasoning**: Honors both Part 8 ("Do NOT write automated test code. Verify everything by actually running and using the app") and existing CI gates.

---

## DEC-004: Local Toolchain vs CI Native Build Strategy
- **Date**: 2026-11-23
- **Context**: Toolchain probe on this Windows host found `node`, `npm`, `rustc`, `cargo`, VS 2022 BuildTools `cmake.exe`, `gh`, `codex`, and Python 3.12 (`PIL`, `playwright`), but **no LLVM / `libclang.dll`**. `llama-cpp-sys-2` uses `bindgen` which requires `libclang.dll` at compile time.
- **Decision**:
  1. Measure native v1.0.0 baseline directly on the already-installed `C:\Program Files\Neurix\neurix-tauri.exe` (`14,857,216` bytes) with the local `qwen-3.5-4b-3d-coder` GGUF present in `%LOCALAPPDATA%\com.neurix.app\models\`.
  2. Run fast frontend dev verification locally against `npm run dev` (mock backend) + Playwright.
  3. Run all Rust compilation, `cargo test`, `cargo clippy`, real-model end-to-end tests, and Windows/Android release-artifact builds via GitHub Actions (`ci.yml` `workflow_dispatch` on branch `next` — artifacts only, never `release.yml`), and install the resulting Windows CI artifact locally for Level 3 end-to-end testing.
- **Reasoning**: Avoids modifying host system packages/LLVM outside repo scope while still exercising genuine compiled Rust + llama.cpp binaries and Windows installers through CI.

---

## DEC-005: Team Calibration & Role Assignments
- **Date**: 2026-11-23
- **Context**: Calibrated 5 distinct models on the identical 2-part benchmark (Task 1: exact line/symbol trace of `ModelSlot`/`ModelOps`/`chatService`/`turn.ts`; Task 2: pure `src/utils/themePreference.ts` following `AGENTS.md` + `biome.json`).
- **Results**:
  | Model | Provider Instance | Time | Accuracy | Code Quality | Instruction Following | Assigned Role |
  |---|---|---|---|---|---|---|
  | `claude-opus-5-5` | `claudeAgent` | ~1m35s | 5/5 | 5/5 (zero casts, `.trim()`, clean JSDoc) | 5/5 | **Heavy Implementer + Lead UI Implementer + Researcher (Track 2)** |
  | `gemini-4-argon` | `antigravity_antigravity_ani` | ~1m45s | 5/5 | 4.5/5 (clean, `.trim()`, 1 minor `as ThemePreference` cast) | 5/5 | **Standard Implementer (Primary) + Researcher (Track 1)** (`VIYLSA` Argon = overflow reserve) |
  | `gpt-6.2-sol` | `codex` | ~2m02s | 5/5 | 5/5 (zero casts `switch` narrowing, ultra-concise) | 5/5 | **Heavy Implementer (Backend/Perf) + Researcher (Track 5)**; **Codex CLI = Graphics (Part 7)** |
  | `gemini-4-hydrogen` | `antigravity_antigravity_ani` | ~2m39s | 5/5 | 4.8/5 (clean, `as const`, 1 minor `as readonly string[]` widening) | 5/5 | **Standard Implementer (Secondary) + Researcher (Track 3)** |
  | `gemini-4-neon` | `antigravity_antigravity_ani` | ~2m47s | 5/5 | 4.8/5 (clean, `.trim()`, 1 minor `as readonly string[]` widening) | 5/5 | **UI Implementer (Secondary) + Researcher (Track 4)** |
- **Decision**: Assign roles as tabulated above. Every model scored 5/5 on factual accuracy with zero hallucinations and respected the read-only constraint, giving us full multi-account rotation capacity. Use `claude-opus-5-5` and `gpt-6.2-sol` for hard Rust/state/UI work, `gemini-4-argon` / `gemini-4-hydrogen` for standard/mechanical tasks, `gemini-4-neon` for design/UI work, and `codex exec` for Part 7 `image_gen`.
- **Reasoning**: Maximizes throughput across all 4 accounts while keeping `antigravity_antigravity_viylsa` reserved for orchestration and final quality gate review.

---

## DEC-006: Visual Identity & Anti-Claude Redesign (`Karakoram Slate` + `Deodar` + `Paper` + `System`)
- **Date**: 2026-11-23
- **Context**: Baseline audit ([BEHAVIOR_NOTES.md](BEHAVIOR_NOTES.md)) and [DESIGN_RESEARCH.md](DESIGN_RESEARCH.md) showed default Graphite (`#262624` + `#d97757`), centered serif greeting, and bottom-left popover mirrored Claude Desktop too closely, while lacking OS theme auto-following.
- **Decision**: Adopt **Direction 1 (`Karakoram Slate`, id `"karakoram"`)** (`#0f1317` recessed sidebar, `#151a20` canvas, `#2ec4b6` Glacial Teal, `#e0a458` Expedition Brass) as Neurix's flagship default theme, paired with upgraded **Paper (`paper`)** (Juniper Pine on archival stock), **Deodar (`deodar`)** (warm obsidian-ink + Juniper Pine + Apricot Gold), **Phosphor (`phosphor`)** (amber CRT), and top-level **`System` (`"system"`)** OS match mode, while mapping legacy theme IDs cleanly and keeping all 4 core themes passing every assertion in `src/theme/theme.test.ts` (including >= 4.5:1 WCAG AA).
- **Reasoning**: Gives Neurix an unmistakable sovereign alpine-instrument look across Windows and Android with zero Claude visual echo.

---

## DEC-007: Non-Blocking Startup, Default `Q8_0` KV Cache Quantization, Flash Attention & Safe Fallback
- **Date**: 2026-11-23
- **Context**: Installed native `v1.0.0` blocked on `BootScreen` for **73.8 seconds** loading a 2.71 GB GGUF on startup, and [engine.rs](src-tauri/src/inference/engine.rs) left Flash Attention, KV quantization (`with_type_k`/`with_type_v`), GPU layers, and `state_save_file` unconfigured despite `llama-cpp-2 = "=0.1.159"` exposing them.
- **Decision**:
  1. Never block startup navigation on `loadModel` in [SplashScreen.tsx](src/pages/SplashScreen.tsx): navigate immediately to `/chat` while loading the last model asynchronously in the background via `AppContext`.
  2. Default new inference settings to `kv_cache_quant = "q8_0"`, `flash_attention = true`, `gpu_layers = 0` (user-tunable up to `999`), and `strip_thinking_history = true`, with automatic one-shot fallback to safe F16/CPU if a GPU driver or exotic model architecture rejects quantized/offloaded context initialization.
  3. Pilot bounded single-conversation KV prompt state persistence across restarts (`state_save_file` / `state_load_file`) keyed strictly by `(model_id, context_length, kv_cache_quant, flash_attention, tokens)`.
- **Reasoning**: Cuts cold interactive launch from ~74s to `< 2s`, reduces 4K/8K KV cache RAM by ~47% on transformer layers, and improves repeat-turn responsiveness without breaking model compatibility.

---

## DEC-008: Persistent SQLite FTS5 Folder RAG Index & `quick-xml` DOCX + Strict Air-Gap Mode
- **Date**: 2026-11-23
- **Context**: `folder_search.rs` walks and re-reads folder trees linearly on every turn, `documents.rs` uses naive `<w:t>` tag string scanning, and offline privacy users demand a verifiable air-gap switch blocking all outbound sockets ([RESEARCH.md](RESEARCH.md)).
- **Decision**: Add `rusqlite` (bundled SQLite + FTS5 `unicode61`, `bm25()`) incremental chunk index keyed by `(size, mtime)` with seamless fallback to `folder_search::best_excerpts`, upgrade DOCX extraction to namespace-aware `quick-xml` (Desktop) with `[Page N]` prefixes on PDF pages, and enforce `Settings.air_gap` inside Rust HF/download/Gmail/GitHub commands.
- **Reasoning**: Eliminates repeated disk scans on connected folders, improves PDF/DOCX source provenance for inline citations, and delivers provable airplane-mode guarantees.

---

## DEC-009: Part 7 Custom Karakoram Artwork & Icon Pipeline (`codex exec` + `PIL`)
- **Date**: 2026-11-23
- **Context**: Baseline `MountainScene` SVG and terracotta `NeurixLogo` icon rely on basic shapes and Claude clay accents.
- **Decision**: Generate bespoke Karakoram Slate hero camp, onboarding monolith, empty-state artwork, and 1024x1024 sovereign `N` app icon via `codex exec` into gitignored `raw-assets/`, inspect every raster image visually, compress optimized WebP assets into `public/assets/art/`, and regenerate all platform icons in `src-tauri/icons/`.
- **Reasoning**: Delivers crisp, lightweight bespoke visuals aligned to `Karakoram Slate` while keeping repo bloat strictly bounded.
