# Performance Baseline

Measured on `main` (`v1.0.1`, commit `a5b7f8667b50a135a25e280acfd6a253529b8b14`, safety tag `before-mission-2026-11-23`) and the locally installed native release build (`v1.0.0`) on **2026-11-23**.

---

## 1. Test Hardware & Environment

| Metric | Observed Value |
|---|---|
| **CPU** | Intel(R) Core(TM) i7-7820HQ CPU @ 2.90GHz (4 cores / 8 threads) |
| **System RAM** | 15.9 GB |
| **GPUs** | NVIDIA Quadro M1200 (4 GB VRAM) + Intel(R) HD Graphics 630 (1 GB) |
| **Free Disk (`C:`)** | 17.74 GB at backup time |
| **Installed Native Binary** | `C:\Program Files\Neurix\neurix-tauri.exe` — `14,857,216` bytes (`ProductVersion: 1.0.0`, `FileVersion: 1.0.0`) |
| **Local Installed GGUF** | `qwen-3.5-4b-3d-coder\model.gguf` — `2,708,804,096` bytes (2.71 GB) |

---

## 2. Production Web Bundle & CI Checks (`npm run build` / Vitest / Biome / TSC)

Baseline verification against `a5b7f86` (`task-86`, zero edits):

- `npm ci`: 116 packages, 0 vulnerabilities (`npm audit`).
- `npm run lint` (`biome lint src`): `Checked 122 files in 1721ms. No fixes applied.` (exit 0).
- `npm run typecheck` (`tsc --noEmit`): exit 0.
- `npm test` (`vitest run`): `Test Files 22 passed (22), Tests 272 passed (272)` in `15.50s` (exit 0).
- `npm run build` (`tsc && vite build`): `vite v6.4.5`, `1721 modules transformed`, built in `33.40s`, **`792,450` bytes total** in `dist/`.

### Bundle Chunk Breakdown (`dist/`)

| Asset | Uncompressed Size | Gzipped | Notes |
|---|---:|---:|---|
| `assets/react-vendor-C0WpXVP_.js` | 173,943 B | 57.50 kB | React / React DOM / Router |
| `assets/index-DwjbmIB3.js` | 130,231 B | 36.10 kB | Core shell + providers + boot |
| `assets/ChatPage-CDciV0Mm.js` | 86,230 B | 26.16 kB | Chat surface, markdown, turn orchestration |
| `assets/highlight-Dgvj6cUD.js` | 84,831 B | 26.96 kB | `highlight.js` chunk (lazy-loaded) |
| `assets/styled-vendor-BafBfPWr.js` | 36,470 B | 14.48 kB | `styled-components` |
| `assets/FriendEditPage-B_xKh3jE.js` | 26,336 B | 7.40 kB | Companion editor + templates |
| `assets/prefs-DViJgOCm.js` | 23,172 B | 6.66 kB | Shared preference stores |
| `assets/fonts/space-grotesk.woff2` | 22,288 B | — | Display font |
| `assets/AppLayout-CWKS6Gku.js` | 21,251 B | 6.08 kB | Sidebar + TitleBar + CommandPalette |
| `assets/CharacterEditPage-*.js` | 20,515 B | 6.11 kB | Character editor |
| `assets/SettingsPage-*.js` | 19,377 B | 6.16 kB | Settings screen |
| `assets/MyModelsPage-*.js` | 16,897 B | 4.71 kB | Installed models view |
| `assets/ConnectorsPage-*.js` | 16,257 B | 4.78 kB | Connectors & local folder UI |
| `assets/ModelStorePage-*.js` | 16,226 B | 4.51 kB | Model catalog browser |
| `assets/ChatHistoryPage-*.js` | 12,509 B | 4.08 kB | Chat search & history list |
| `assets/fonts/inter.woff2` | 10,252 B | — | Sans font |
| `assets/AddModelPage-*.js` | 9,917 B | 3.25 kB | Hugging Face URL importer |
| `assets/DownloadingPage-*.js` | 9,292 B | 3.21 kB | Model download monitor |
| `assets/persona-*.js` | 9,243 B | 4.24 kB | Persona definitions |
| `assets/ModelDetailPage-*.js` | 8,008 B | 2.79 kB | Single model specifications |
| `assets/connectors-*.js` | 7,185 B | 3.14 kB | Connector client helpers |
| `assets/OnboardingScreen-*.js` | 6,757 B | 2.36 kB | First-run onboarding |
| `assets/fonts/jetbrains-mono.woff2` | 5,888 B | — | Monospace font |
| `assets/AboutPage-*.js` | 4,008 B | 1.43 kB | About screen |
| `assets/fonts.css` | 1,166 B | — | Font-face declarations |
| `index.html` | 817 B | 0.42 kB | Document shell |

---

## 3. Native Desktop Runtime Baseline (`v1.0.0`, `neurix-tauri.exe`)

Measured against real installed native app with `qwen-3.5-4b-3d-coder\model.gguf` (2.71 GB) configured as the default model:

| Metric | Baseline Observation | Bottleneck / Diagnosis |
|---|---|---|
| **Window Handle Creation** | Trial 1: `2,629 ms` (`2,692 ms` title); Trial 2: `761 ms` (`806 ms` title); `task-160` visible: `694 ms` | Fast native shell creation once WebView2 is warm |
| **Interactive Startup (`BootScreen` -> `/chat`)** | **`73,785 ms` (~73.8 s)** | **Critical bottleneck**: [SplashScreen.tsx](src/pages/SplashScreen.tsx) blocks navigation on `await loadModel(target.id)` before opening `/chat`. At t=10s (`native-v1.0.0.png`), the user is still frozen on `BootScreen`. |
| **Pre-load Memory (t = 10.5 s)** | **`410.97 MB` WorkingSet** (`116.91 MB` Rust + `294.06 MB` WebView2) | Baseline before GGUF weights finish mapping |
| **Settled Memory (t > 74 s, 8 processes)** | **`3,290.55 MB` WorkingSet** (`2,950.97 MB` Rust + `338.56 MB` WebView2), **`2,534.72 MB` Private** | Model weights + default unquantized KV cache + CPU runtime (~2.95 GB RSS in Rust alone) |
| **Settled Idle CPU (10 s window)** | `0.671875 s` delta -> **`0.84%` all-core / `6.719%` single-core** | Healthy quiet idle loop once loaded |
| **Installer / Exe Footprint** | `14,857,216` bytes (~14.17 MB raw exe) | Compact CPU-only `llama.cpp` bundle |

---

## 4. Web / Mock Runtime Latency Baseline (Playwright + Edge, Vite Dev)

Run via local Playwright (`channel="msedge"`, `1280x800` desktop + `390x844` mobile) against `http://localhost:1420` (`task-362`):

- **Console Errors**: `0`
- **Console Warnings**: `0`
- **Uncaught Page Errors**: `0`

| Measurement | Observed (Vite Dev + Lazy Chunks) |
|---|---:|
| Navigation `domInteractive` | `2,477 ms` |
| Navigation `loadEventEnd` | `5,293 ms` |
| First Contentful Paint (`fcp`) | `6,108 ms` |
| First load -> `splash-screen` visible | `6,360.4 ms` |
| `Ctrl+K` Command Palette open | `135.5 ms` |
| Theme switch (`Graphite` -> `Paper`) | `456.5 ms` |
| Chat History filter (`yaml`) | `520.0 ms` (incl. script settle wait) |
| Model Store filter (`Gemma`) | `153.4 ms` |
| Route `/chat/history` first lazy load | `1,554.1 ms` |
| Route `/store` first lazy load | `1,751.1 ms` |
| Route `/store/add` first lazy load | `1,544.1 ms` |
| Route `/models` first lazy load | `1,500.3 ms` |
| Route `/connectors` first lazy load | `1,591.5 ms` |
| Route `/friend/new` first lazy load | `4,257.9 ms` |
| Route `/character/new` first lazy load | `2,132.6 ms` |
| Route `/about` first lazy load | `969.8 ms` |

> Note: Vite dev route times include on-demand ES module compilation in dev mode (`vite.js`); production builds serve pre-chunked assets from `dist/`.

---

## 5. Architecture Performance Hotspots Identified

1. **Blocking Model Load on Startup (`SplashScreen.tsx`)**: Prevents reading conversation history, changing settings, or browsing Model Store for ~74 seconds on cold start with a 2.7 GB model.
2. **CPU-Only Inference + Missing KV/Flash Optimizations (`src-tauri/src/inference/engine.rs`)**:
   - No Vulkan/CUDA GPU layer offloading (`n_gpu_layers` missing/0), Flash Attention (`flash_attention_policy`), or quantized KV cache (`q8_0`/`q4_0`), leaving idle VRAM (`4 GB` Quadro M1200) unused and forcing huge memory/latency overhead.
   - No KV prompt state persistence (`state_save_file`) or sliding-window context shifting across turns.
3. **O(n) Folder Scan on Every Search (`src-tauri/src/folder_search.rs`)**: Re-walks connected folders and re-reads plain files instead of using an incremental SQLite FTS5 + BM25 index.
4. **Full JSON Chat Serialization (`src-tauri/src/chat/storage.rs`)**: Reads/writes full chat arrays and renders unvirtualized DOM message trees cleanly only for short sessions.

---

## 6. Phase 2 Performance Targets & Budgets

| Metric | Baseline (v1.0.0 / v1.0.1) | Phase 2 Target |
|---|---:|---:|
| **Time to Interactive `/chat`** | `73,785 ms` (blocked on GGUF load) | **< `2,000 ms`** (non-blocking shell + background model load with toast/header indicator) |
| **Native Window Open** | `694–2,629 ms` | **< `1,000 ms`** warm |
| **Total `dist/` JS + Assets** | `792,450 B` | **<= `1,150,000 B`** after rich UX + SVG/raster art upgrades (no unsplit bloat) |
| **Idle Memory (before model load)** | `410.97 MB` WS | **<= `450 MB`** WS |
| **KV Cache Memory at 8K Context** | FP16 baseline (~2.95 GB total Rust RSS) | **`Q8_0` default** (~45–50% KV savings on large contexts) + optional `Q4_0` |
| **Settled Idle CPU** | `0.84%` all-core | **<= `1.0%`** all-core |
| **Command Palette / Filter Latency** | `135.5 ms` / `153.4 ms` | **<= `100 ms`** interactive |
| **Console / Page Errors** | `0` | **`0`** |

---

## Post-Mission Measurements (Wave 4 — After)

Measured after final commit `084619b` on branch `next`, using the CI-built Windows binary (`neurix-tauri.exe`, `19,201,536` bytes from run [`45153453423`](https://github.com/Razee4315/neurix/actions/runs/45153453423)) against the user's real local 2.71 GB `qwen-3.5-4b-3d-coder\model.gguf` (`2,708,804,096` bytes), plus full Playwright Edge walkthrough (`walkthrough_after.py` across `1280x800` desktop & `390x844` mobile) and production Vite bundle (`npm run build`).

### 1. Native Windows Desktop Benchmark (`neurix-tauri.exe` vs `v1.0.0` Baseline)

| Metric | Baseline (`v1.0.0` Installed) | After (`next` / `084619b` CI Build) | Observed Delta |
|---|---:|---:|---|
| **Startup UI Block (`BootScreen`)** | `73,785 ms` blocked before UI usable | **Non-blocking startup** (`SplashScreen` navigates immediately on JS/store check; background model load finishes at `~34.9 s` / settled `37,661 ms`) | Eliminates synchronous `73.8 s` UI lock; app stays responsive while GGUF loads in background |
| **Window Visible (`Title='Neurix'`)** | `694–2,629 ms` | `2,924 ms` (first-launch cold WebView2 `PrintWindow` capture at `5 s` -> `native-after-5s.png` at `279.24 MB` WS / `108.86 MB` Private while `Rust=29.75 MB`) | Splash opens cleanly on Karakoram `#151A20` |
| **Model-Load Settle Time** | `~74,000 ms` (`BootScreen`) | **`37,661 ms`** (`Rust` model load active `t=11.8s–30.7s`, CPU `< 2%` by `34,869 ms`) | **~49% faster** total time to settled model readiness |
| **Committed Private Memory (Settled)** | `2,534.72 MB` (`8` processes) | **`2,410.10 MB`** (`7` processes) | **`-124.62 MB`** Private RAM (`Q8_0` KV + Flash Attention) |
| **Settled Working Set (OS Mapped)** | `3,290.55 MB` (`2,950.97 MB` Rust + `338.56 MB` WebView2) | `3,788.36 MB` (`3,457.46 MB` Rust + `330.90 MB` WebView2) | WebView2 down `-7.66 MB`; Rust maps model + KV state |
| **True Settled Idle CPU (10 s window)** | `0.671875 s` (`0.84%` all-core / `6.719%` single-core) | **`0.140625 s` (`0.176%` all-core / `1.406%` single-core)** | **`-79%` idle CPU** (4.8x lower background CPU) |
| **Compiled Binary Size** | `14,857,216` bytes | `19,201,536` bytes (includes bundled SQLite FTS5 + `quick-xml`) | +4.14 MB for offline FTS5 & DOCX engine |

Native screenshots captured in [docs/mission/after/](docs/mission/after/):
- [native-after-5s.png](docs/mission/after/native-after-5s.png) (`t = 5 s` Karakoram splash, `Rust = 29.75 MB`, before background weight load)
- [native-after-settled.png](docs/mission/after/native-after-settled.png) (`t = 37.7 s` settled `/chat` with `Qwen 3.5 4B 3D Coder · KV Q8_0 · Flash Attn · 8.2k ctx`)

### 2. Web Production Build & Playwright Verification (`after_metrics.json`)

| Metric / Check | Baseline | After (`next` / `084619b`) |
|---|---:|---|
| **`dist/` Core Initial Shell** | `792,450 B` total unsplit baseline | **`363,136 B`** (`index.html`, `index-CpWPjb_l.js` `150.78 kB`, `react-vendor` `174.20 kB`, `styled-vendor` `36.68 kB`, CSS) |
| **`dist/` Total Pre-Chunked Assets** | `792,450 B` | `7,642,516 B` across **`187` files** (includes lazy-only KaTeX fonts/JS, Mermaid diagrams & `elk`/`cynefin` on demand, and 24 per-language `highlight.js` chunks; `ChatPage` chunk = `151.20 kB` / `44.37 kB` gzip) |
| **Playwright Console / Page Errors** | `0` console, `0` page errors | **`0` console errors, `0` page errors** across 21 captures |
| **Viewport Horizontal Overflow** | Not checked programmatically | **`overflow: false`** (`scrollWidth == 1280` desktop, `390` mobile) on all 20 captured route checks |
| **Verified Themes & Interactive Checks** | Single Graphite default | `karakoram` default, `deodar`, `paper` switched live; Retry `< 1 / 2 >` variants verified (`passed: true`); Model Detail CTA above fold (`y=308.4, h=48`, `passed: true`); `Connectors` zero `"coming soon"` (`true`); Mobile `390x844` ComposerBar pairwise overlap across 4 controls (`overlaps: []`, `passed: true`) |

