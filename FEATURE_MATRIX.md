# Local AI Feature Comparison Matrix

> **Legend:** `yes` = shipped & working in `v1.0.1` (`a5b7f86`); `partial` = present with material limitations/gaps; `no` = absent or placeholder stub; `?` = unverified in public competitor docs/sources read `2026-11-23`.

---

## 1. Core Chat, Streaming & Branching

| Feature | **Neurix (`v1.0.1`)** | Jan (`v0.8.8`) | LM Studio (`0.4.x`) | Msty (`3.0.1`) | AnythingLLM (`v1.20`) | GPT4All (`v3.10`) | Cherry Studio (`v2.2.3`) | Open WebUI (`v0.8`) | PocketPal (`v1.24`) | Layla (`7.8.0`) | Claude Desktop |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Real-time streaming markdown + code copy | `yes` | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes |
| Collapsible reasoning (`<think>`) blocks | `yes` | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes |
| Strip `<think>` blocks from follow-up context | `partial` | partial | yes | yes | partial ([#7272](https://github.com/Mintplex-Labs/anything-llm/issues/7272)) | ? | partial ([#10408](https://github.com/CherryHQ/cherry-studio/issues/10408)) | yes | yes | ? | yes |
| Reasoning effort budget selector | `no` | partial | yes | yes | no ([#7226](https://github.com/Mintplex-Labs/anything-llm/issues/7226)) | no | yes | yes | yes | ? | yes |
| Edit prompt in place & regenerate siblings (`< 1/N >`) | `no` | yes | yes | yes | no | no ([#2784](https://github.com/nomic-ai/gpt4all/issues/2784)) | yes | yes | partial | yes | yes |
| Tree branching / fork conversation ("Subtopics") | `no` | no | yes | yes | no | no | yes | yes | no | ? | partial |
| Multi-model Split View comparison | `no` | no | yes | yes | no | no | yes | yes | no | no | no |
| Queue next message while streaming (`turn.ts`) | `yes` | no | yes | yes | no | no | partial | yes | no | no | no |
| In-chat text find (`Ctrl+F`) | `yes` | ? | yes | yes | no | no | yes | yes | no | no | no |
| Reusable `/slash` prompt library + variables | `no` | no | yes | yes | yes | no | yes | yes | no | yes | yes |

---

## 2. Model Management & Inference Engine

| Feature | **Neurix (`v1.0.1`)** | Jan (`v0.8.8`) | LM Studio (`0.4.x`) | Msty (`3.0.1`) | AnythingLLM (`v1.20`) | GPT4All (`v3.10`) | Cherry Studio (`v2.2.3`) | Open WebUI (`v0.8`) | PocketPal (`v1.24`) | Layla (`7.8.0`) | Claude Desktop |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Embedded zero-daemon `llama.cpp` inference | `yes` | yes | yes | yes | yes | yes | no (external) | no (Ollama/server) | yes | yes | no (cloud) |
| Instant non-blocking app launch (background load) | **`no`** *(73.8s block)* | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes |
| GPU acceleration (Vulkan / CUDA / OpenCL) | **`no`** *(CPU only)* | yes | yes | yes | yes | yes | external | external | yes (OpenCL/Metal) | yes | n/a |
| Flash Attention + KV cache quant (`Q8_0`/`Q4_0`) | `no` | yes | yes | yes | partial | partial | external | external | yes | ? | n/a |
| Per-model defaults (ctx, offload, temperature, stop) | `no` | yes | yes | yes | yes | yes | yes | yes | yes | yes | n/a |
| Pre-load hardware RAM/VRAM + KV fit warning | `partial` *(catalog fit only)* | yes | yes | yes | partial | partial | no | no | yes | yes | n/a |
| Curated Store + Hugging Face GGUF inspector | `yes` | yes | yes | yes | partial | yes | no | no | yes | yes | no |
| Quantization picker per HF model repo | `partial` | yes | yes | yes | partial | partial | no | no | yes | yes | no |
| Prompt KV cache save/restore across app restarts | `no` | partial | yes | yes | no | no | no | no | no | no | n/a |
| Per-message speed telemetry (`tok/s`) & test benchmark | `yes` | yes | yes | yes | partial | partial | yes | yes | yes | yes | no |
| Live context-window fill meter (`tokens / n_ctx`) | `partial` *(unlabeled ring)* | yes | yes | yes | yes | yes | yes | yes | yes ([#745](https://github.com/Mobile-Artificial-Intelligence/maid/issues/745) benchmark) | yes | no |
| Local OpenAI-compatible HTTP API server | `no` | yes | yes | yes | yes | yes | no | yes | no | no | no |

---

## 3. Local Knowledge, RAG & Connectors / MCP

| Feature | **Neurix (`v1.0.1`)** | Jan | LM Studio | Msty | AnythingLLM | GPT4All | Cherry Studio | Open WebUI | PocketPal | Layla | Claude Desktop |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Local folder context attachment | `partial` *(linear O(n) scan)* | yes | yes | yes | yes | yes (`LocalDocs`) | yes | yes | no ([#183](https://github.com/a-ghorbani/pocketpal-ai/issues/183)) | ? | yes |
| Persistent local index (SQLite FTS5 / Vector DB) | `no` | partial | yes | yes | yes (LanceDB) | yes (SQLite) | yes (`sqlite-vec` + FTS5) | yes (BM25 + Chroma) | no | ? | yes |
| Small-doc full inject vs large-doc RAG fallback | `no` | partial | yes | yes | yes (Pin vs Embed) | no | partial | yes | no | no | yes |
| Clickable RAG source citations & chunk viewer | `no` | no | yes | yes | yes | yes | yes | yes | no | no | yes |
| PDF + DOCX document parsing | `partial` (`lopdf`, basic tag scan) | yes | yes | yes | yes (+OCR) | yes | yes | yes (+OCR) | no | ? | yes |
| Read-only Gmail & GitHub connectors | `yes` | no | no | partial (Msty Go) | yes (GitHub) | no | partial | partial | no | no | yes (no GH in Cowork) |
| Custom MCP (`stdio` / SSE) tool-calling client | **`no`** *("Coming soon" stub)* | yes | yes | yes | yes | no | yes | yes | no ([#779](https://github.com/a-ghorbani/pocketpal-ai/issues/779)) | no | yes (`.mcpb`) |
| OS keychain storage for connector secrets | `no` | ? | yes | ? | yes | n/a | ? | n/a | n/a | ? | yes |

---

## 4. Characters, Friends & Persistent Memory

| Feature | **Neurix (`v1.0.1`)** | Jan | LM Studio | Msty | AnythingLLM | GPT4All | Cherry Studio | Open WebUI | PocketPal | Layla | Claude Desktop |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Custom system-prompt Characters / Assistants | `yes` | yes | yes | yes | yes | yes | yes | yes | yes ("Pals") | yes | yes (Projects) |
| Companion "Friends" with traits & style presets | `yes` | no | no | partial | no | no | partial | no | partial | yes | no |
| Persistent long-term Friend memory across chats | `partial` *(learned, hidden ledger)* | no | no | yes (Shadow Aurum) | partial | no | no | partial ([#28400](https://github.com/open-webui/open-webui/issues/28400)) | no | yes | yes |
| User-inspectable & editable memory ledger | `no` | no | no | partial | no | no | no | yes | no | partial | yes |
| Tavern / SillyTavern Character Card V2 PNG/JSON import | `no` | no | no | no | no | no | no | yes | no ([#286](https://github.com/a-ghorbani/pocketpal-ai/issues/286)) | yes | no |
| Multi-character Group / Crew chat room | `no` | no | no | yes ("Crew") | no | no | yes | partial | no | yes | no |

---

## 5. Productivity, Artifacts & Search

| Feature | **Neurix (`v1.0.1`)** | Jan | LM Studio | Msty | AnythingLLM | GPT4All | Cherry Studio | Open WebUI | PocketPal | Layla | Claude Desktop |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Command Palette (`Ctrl+K`) | `yes` | yes | yes | yes | partial | no | yes | yes | no | no | yes |
| Inline Artifact / File Cards + Sandboxed Preview | `partial` *(basic HTML/file cards)* | no | no | partial | yes (slides/charts) | no | yes (Portal/HTML) | yes (Canvas) | no | no | yes (editable) |
| Native KaTeX LaTeX math + Mermaid diagrams | `no` | yes | yes | yes | yes | partial | yes | yes | partial | ? | yes |
| Full-text chat history search + jump-to-match | `partial` *(linear JSON filter, no jump)* | yes | yes | yes | yes | yes | yes | yes | yes | yes | partial (title-only) |
| Folders / tags / pinned threads organization | `no` | yes | yes | yes | yes | no | partial | yes | no | ? | yes (Projects) |
| Virtualized long conversation rendering (1,000+ msgs) | `no` | yes | yes | yes | partial | yes | yes | yes | yes | yes | yes |
| Multimodal image vision (`mmproj` GGUF) | `no` | yes | yes | yes | yes | no ([#3598](https://github.com/nomic-ai/gpt4all/issues/3598)) | yes | yes | yes | yes | yes |
| Offline Voice (Whisper STT / Kokoro-Piper TTS) | `no` | no | no | no | yes | no | yes | yes | yes | yes | yes (cloud) |
| Full local backup & Cloud JSON import (ChatGPT/Claude) | `partial` *(export/import only)* | partial | no | yes (ZIP) | yes | no | yes (WebDAV) | yes | yes | yes | export only |

---

## 6. Privacy, Offline & Cross-Platform Reach

| Feature | **Neurix (`v1.0.1`)** | Jan | LM Studio | Msty | AnythingLLM | GPT4All | Cherry Studio | Open WebUI | PocketPal | Layla | Claude Desktop |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Zero-account offline first launch & usage | `yes` | yes | yes | yes | yes | yes | yes | local auth | yes | yes (with paywall) | no |
| Zero telemetry + strict offline/air-gap lock | `partial` *(offline by default, no UI lock)* | partial ([#8212](https://github.com/janhq/jan/issues/8212)) | no (Bionic cloud) | yes | yes | yes | partial ([#14387](https://github.com/CherryHQ/cherry-studio/issues/14387)) | yes | yes | no (cloud upsells) | no |
| **Native Windows Desktop + Android local GGUF in ONE codebase** | **`yes`** | no (desktop) | no (desktop) | no (desktop) | partial (companion) | no (desktop) | partial (API client) | PWA only | no (mobile only) | no (mobile only) | no |
| Light Rust/Tauri idle RAM (no Electron overhead) | **`yes`** | yes (Tauri 2) | no (Electron) | no (Electron) | no (Electron) | yes (Qt C++) | no (Electron) | server+browser | yes (RN) | yes (native) | no (Electron) |
| Global Windows quick-ask shortcut window (`Alt+Space`) | `no` | no | no | yes | no | no | yes | no | n/a | n/a | yes |
| Android background auto-unload & 16KB page safety | `no` | n/a | n/a | n/a | no | n/a | no | n/a | partial | yes | n/a |

---

## 7. Visual Craft & Customizability

| Feature | **Neurix (`v1.0.1`)** | Jan | LM Studio | Msty | AnythingLLM | GPT4All | Cherry Studio | Open WebUI | PocketPal | Layla | Claude Desktop |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Distinct, non-derivative visual brand identity | **`no`** *(Claude clone default)* | yes | yes | yes | yes | yes | yes | yes | yes | yes | n/a (original) |
| Multiple cohesive themes + `System` (`auto`) sync | `partial` *(4 themes, no System auto)* | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes |
| Native Windows 11 Mica / custom Snap title bar | `no` | partial | partial | no | no | native frame | partial | browser | n/a | n/a | partial |
| Clean mobile thumb-zone ergonomics (no toolbar clipping) | `partial` *(`mobile-chat.png` collision)* | n/a | n/a | n/a | partial | n/a | yes | yes | yes | yes | yes |
| Labeled typography/comfort controls (`Small`–`XL`) | `partial` *(4 unlabeled `Aa` buttons)* | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes |

---

## 8. Honest Gap Analysis & Winning Wedges

### Where Neurix Already Leads
1. **True Single-Product Windows + Android Local GGUF Runtime:** LM Studio, Msty Studio, Jan, and GPT4All lack native Android local GGUF inference; PocketPal AI and Layla lack native Windows desktop clients.
2. **Rust + Tauri 2 Footprint:** Zero Electron/Python bloat (`14.86 MB` Windows binary; `116.9 MB` Rust pre-load WS).
3. **Unique 4-Pillar Combination:** No other open-source app in the surveyed field natively bundles **Local GGUF inference + Companion Friends with Memory + Read-Only Personal Connectors (Folders/Gmail/GitHub) + HTML Artifacts** without accounts or telemetry.

### Critical Deficits Blocking Market Leadership Today
1. **Unacceptable Cold-Start Wait (`73.8s` BootScreen):** Synchronously awaiting GGUF load on startup negates Tauri 2's speed advantage; users must enter `/chat` in `< 2s` while models warm asynchronously.
2. **Untapped `llama.cpp` Engine Features Already Inside `0.1.159`/`0.1.161`:** Zero GPU/Vulkan offload, zero Flash Attention, zero KV cache quantization (`Q8_0`/`Q4_0`), zero prompt state persistence across restarts, and zero context shifting.
3. **Derivative Default Visual Identity & Visual Bugs:** Graphite (`#262624` + `#d97757`) looks like Claude Desktop; mobile composer text clips into the ContextIndicator ring; dead `"Coming soon"` connector cards clutter `/connectors`; `New character` icon grid hides form inputs below the fold; `Model detail` hides the `Download` CTA below the fold.
4. **Power-User Table Stakes Missing:** Edit-as-branch / `< 1/3 >` regenerations, SQLite FTS5 folder/chat indexing, KaTeX + Mermaid rendering, TavernAI Character Card V2 import (critical post-Backyard AI shutdown), explicit Air-Gap toggle, and editable Friend memory.
