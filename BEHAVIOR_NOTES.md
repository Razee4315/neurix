# Neurix Baseline Behavior Notes (`main` @ `a5b7f86` + Installed `v1.0.0`)

Screen-by-screen behavioral and visual audit of Neurix captured via live native inspection (`v1.0.0`) and full Playwright Chromium/Edge walkthrough (`1280x800` desktop, `390x844` mobile, mock IPC mode, `0` console/page errors).

---

## 1. Global Shell, Window Chrome & Navigation

- **Window Config (`tauri.conf.json`)**: Default desktop window `1120x760`, minimum width `380px`, `decorations: false` (custom client-drawn titlebar with minimize/maximize/close), `withGlobalTauri: false`.
- **Desktop Navigation (`AppLayout.tsx`, `Sidebar.tsx`)**:
  - Persistent 240px left sidebar containing brand mark (`N Neurix`), terracotta `+ New chat` CTA (`Ctrl+N`), `Search chats` (`Ctrl+Shift+F`), `Chats`, `Models`, `Model Store`, `Connectors`, a `Recents` list of past chats, and a bottom-left footer card (`On this device · <model> · offline v`) opening a flyout menu with `Settings`, `About`, and model shortcut.
  - **Command Palette (`Ctrl+K`)**: Opens quickly (`135.5 ms`), indexing recent chats, navigation actions, theme toggles, New Friend, and New Character. See [desktop-palette.png](docs/mission/baseline/desktop-palette.png).
- **Mobile Navigation (`< 640px` / coarse pointer)**: Replaces sidebar with a 5-tab fixed bottom bar (`Chat`, `Models`, `Store`, `Connect`, `Settings`) — visible in [mobile-chat.png](docs/mission/baseline/mobile-chat.png) and [mobile-store.png](docs/mission/baseline/mobile-store.png).
- **Observed Shell / Chrome Bugs**:
  1. **Windows DPI Window Clipping (`v1.0.0`)**: On 125% Windows display scaling, [native-v1.0.0-settled.png](docs/mission/baseline/native-v1.0.0-settled.png) captured the right window border slightly clipped on the native surface.
  2. **Visual Twin of Claude Desktop**: Graphite theme (`#262624` background, `#D97757` terracotta accent), bottom-left profile/device pill menu, serif centered welcome headline (`Hi! What can I help you with?`), and prompt starter grid closely replicate Claude Desktop.
  3. **Duplicate Entry Points & Theme Lack of System Sync**: `+ New chat` appears in both the top-left sidebar and top-right chat header; `Settings` has no `System` (`prefers-color-scheme`) auto-theme mode.

---

## 2. Screen-by-Screen Documentation

### 2.1 Native Boot vs First-Run Splash (`/`)
- **Native Installed Behavior (`v1.0.0`)**: When an installed GGUF model exists, [SplashScreen.tsx](src/pages/SplashScreen.tsx) waits synchronously on `BootScreen` (`Loading Qwen 3.5...`) until `loadModel()` resolves before entering `/chat`. On our 2.71 GB local model, startup froze for **`73.8 seconds`**. See [native-v1.0.0.png](docs/mission/baseline/native-v1.0.0.png) and [native-v1.0.0-settled.png](docs/mission/baseline/native-v1.0.0-settled.png).
- **First-Run Splash (`/` when no models downloaded)**: Displays centered Neurix mark, dusk mountain artwork (`Your AI. Your device. No cloud.`), `Get started` primary button, `Browse all models` secondary link, and offline assurance badge (`100% PRIVATE · WORKS OFFLINE`). See [desktop-splash.png](docs/mission/baseline/desktop-splash.png).

### 2.2 First-Run Onboarding (`/onboarding`)
- Hardware-aware model recommendation (`Qwen 3.5 2B · 1.3 GB`) with Quality/Speed pip meters, `Our pick for your 8 GB of memory` note, `Download · 1.3 GB` CTA, and `Choose a different model` link to `/store`. See [desktop-onboarding.png](docs/mission/baseline/desktop-onboarding.png).
- **Observed Issue**: Typo/spacing artifact `"1.3  GB"` extra space inside monospace size readout; static 8 GB mock label regardless of host RAM in dev mode.

### 2.3 Download Progress (`/downloading`)
- Displays active model name/size, live speed (`216.7 MB/s` in mock), remaining ETA, progress bar + percentage pill in both main view and left sidebar (`Model Store 20%`), plus `PAUSE` and `CANCEL` controls. Automatically loads the finished model and hands off to `/chat` (`downloadHandoff.ts`). See [desktop-downloading.png](docs/mission/baseline/desktop-downloading.png).

### 2.4 Chat Workspace (`/chat`)
- **Welcome State**: Header shows active character/friend selector (`Default v`) on left and `New chat` + `History` icon buttons on right. Center canvas displays `N Hi! What can I help you with?`, tagline (`Helpful and balanced. Everything stays on this device.`), rounded composer (`Think`, `Create files`, `<model> v`, send arrow), privacy sub-caption, and a 2x2 grid of prompt starters (`Summarize...`, `Help me draft...`, `Explain something...`, `Brainstorm...`). See [desktop-chat-welcome.png](docs/mission/baseline/desktop-chat-welcome.png).
- **Active Chat State**: Renders user messages, collapsible `Thought for Ns v` reasoning accordions (`Reasoning.tsx`), GFM tables, blockquotes, lists, syntax-highlighted code blocks (`highlight.ts`) with `Wrap` / `Save` / `Copy` buttons, tok/s + token counter pill, and action buttons (`Copy`, `Export`, `Regenerate`, `Delete`). Supports Paper warm serif theme ([desktop-chat-paper.png](docs/mission/baseline/desktop-chat-paper.png)) and `Ctrl+F` in-chat search (`FindBar.tsx`). See [desktop-chat-active.png](docs/mission/baseline/desktop-chat-active.png).
- **Observed Chat Bugs & UX Gaps**:
  1. **Mobile Composer Toolbar Collision (`390px`)**: In [mobile-chat.png](docs/mission/baseline/mobile-chat.png), enabling `Think` shows `"Reasons first: ca..."` inline text beside the button, which gets truncated and collides directly into the circular `ContextIndicator` ring! Attached repo/file chips (`Create files`, repo pill) also crowd/clip the toolbar.
  2. **First-Reply Scroll Clipping / `Coachmark` Overlap**: Active scroll positioning scrolled past the top of the user prompt (`"Show me a yaml config..."` pushed out of frame in [desktop-chat-active.png](docs/mission/baseline/desktop-chat-active.png)), and the top assistant line under `Paper` + `Large text` slightly clips under the top header band. In multi-turn README/first-run flows, `Coachmark` (`ChatPage.tsx`) overlaps the top of the reply banner.
  3. **Opaque `ContextIndicator` Ring**: Small circular SVG progress ring beside the model switcher has zero text label or hover context explanation in the UI.
  4. **Missing Visible Attachment / Multimodal Entry & Conversation Branching**: Composer shows `Think` and `Create files` (which toggles inline HTML/code preview hint) but lacks an obvious `+` attachment button for local files/PDFs/images, and has no edit-and-branch tree, fork-at-message, or multi-column compare.
  5. **Starter List Placement**: `StarterList` renders below the composer on current `main` (pushed low on smaller heights).

### 2.5 Chat History & Search (`/chat/history`)
- Live search bar (`Search titles and messages...`), `Clear all` header button, date-grouped conversation cards (`Today`) showing persona icon badge, title, model name + timestamp, inline `Rename`, and `Delete`. Filtering updates snippets immediately (`...Show me a yaml config and table example...`). See [desktop-history.png](docs/mission/baseline/desktop-history.png).
- **Gaps**: No folders/projects/tags, no pinned chats, no JSON/Markdown bulk export or search-hit jump-to-message inside long threads.

### 2.6 Model Store (`/store`), Model Detail (`/store/model`) & Add HF Model (`/store/add`)
- **Model Store (`/store`)**: Free storage readout (`51.5 GB free` in mock), live search input (`Search models...`), category pills (`All`, `Tiny`, `Fast`, `Balanced`, `Smart`, `Specialist`), model cards showing size, short summary, Quality/Speed pip meters, `Can think` / `Thinks first`, and `INSTALLED` badges. See [desktop-store.png](docs/mission/baseline/desktop-store.png) and [mobile-store.png](docs/mission/baseline/mobile-store.png).
- **Model Detail (`/store/model`)**: Vendor eyebrow, model title, category badge, hardware compatibility callout (`Runs well on this device`), `BEST FOR` tags, key-value `SPECIFICATIONS` table (Company, Parameters, Quantization, Reasoning, Memory needed, Context window, Released, Download size), and `Download · 3.3 GB` CTA. See [desktop-model-detail.png](docs/mission/baseline/desktop-model-detail.png).
- **Add from Hugging Face (`/store/add`)**: Instructions for GGUF imports, external HF browser button, URL input (`https://huggingface.co/owner/model-GGUF`), and `Check` action. See [desktop-add-model.png](docs/mission/baseline/desktop-add-model.png).
- **Observed Issues**:
  - In **Model Detail**, the `SPECIFICATIONS` card pushes the primary `Download` button **below the 800px desktop fold** (completely hidden without scrolling in [desktop-model-detail.png](docs/mission/baseline/desktop-model-detail.png)). Users also cannot pick alternative GGUF quantizations (`Q4_K_M` vs `Q5_K_M` vs `Q8_0`) per repo directly in the store detail view.
  - In **Model Store**, the `Add from Hugging Face` entry is buried at the bottom below the entire model list rather than in the header or beside Search.

### 2.7 My Models (`/models`)
- Top storage usage progress bar (`1 model · 51.5 GB free · 1.3 GB`), `+ Browse Store` header link, active card highlighted in terracotta border (`In use` badge), full-width `New chat` button, plus `Speed test`, `Unload`, and `Delete` actions. See [desktop-models.png](docs/mission/baseline/desktop-models.png).
- **Gaps**: Missing per-model inference tuning (`GPU layers`, `Context length`, `KV cache quant`, `System prompt / Temperature`), no local `.gguf` file picker from disk on desktop without HF URL, and no OpenAI-compatible local API server toggle.

### 2.8 Connectors (`/connectors`)
- **Available Cards (Live)**: `Local folders` (On this device), `Gmail` (Read only app password), `GitHub` (Public repositories). Plus file/document drop attachment support inside `/connectors` (`Documents`).
- **Coming Soon Section + Dashed Stub**: 4 disabled cards (`Google Drive`, `Outlook`, `Slack`, `Notion` marked `Soon`) and a large dashed placeholder (`Add a custom connector · Any MCP server running on this computer or your network`). See [desktop-connectors.png](docs/mission/baseline/desktop-connectors.png).
- **Observed Issues**:
  1. **Awkward 2-Column Grid**: 3 live cards in a 2-column grid leave an empty orphan slot next to `GitHub`.
  2. **Non-Functional Advertised Features**: Custom MCP server connector button only triggers a `"Coming soon"` toast (`comingSoon("Custom MCP servers")`), and 4 major cloud connector tiles inflate chrome while doing nothing.
  3. **O(n) Folder Search (`folder_search.rs`)**: Reads files on demand without SQLite FTS5 indexing or vector/hybrid chunk ranking, and PDF extraction relies on basic `lopdf` parsing without OCR/table awareness.

### 2.9 Friends (`/friend/new`) & Characters (`/character/new`)
- **New Friend (`/friend/new`)**: Polishes nicely with 8 starter templates (`Sam`, `Iris`, `Max`, `Nova`, `Jules`, `Ember`, `Sage`, `Lina`), a 2-column form + sticky live preview card, icon/color pickers, traits/story/memory config, and pinned bottom bar (`Say hi`, `Create friend`). See [desktop-friend-new.png](docs/mission/baseline/desktop-friend-new.png).
- **New Character (`/character/new`)**: Uses a single tall vertical column where a massive 6x4 icon picker and color swatches consume the **entire first viewport** above `"Name"`, with `"Instructions"`, `"Starter prompts"`, and `"Test reply"` buried far below the fold. Contrast [desktop-character-new.png](docs/mission/baseline/desktop-character-new.png) vs [desktop-friend-new.png](docs/mission/baseline/desktop-friend-new.png).
- **Gaps**: No **Character Card v2 (Tavern PNG/JSON)** import/export (critical after Backyard AI shutdown), and Friends' memory system lacks a inspectable/editable per-friend memory ledger screen accessible cleanly outside edits.

### 2.10 Settings (`/settings`) & About (`/about`)
- **Settings (`/settings`)**: 4 theme swatches (`Graphite`, `Paper`, `Phosphor`, `Dusk`), 4 text-size segments, Chat toggles (`Default character`, `Save chat history`, `Show token speed`, `Send with Enter`, `Suggested prompts`, `Copy replies automatically`, `Friends learn from chats`). See [desktop-settings.png](docs/mission/baseline/desktop-settings.png).
- **Observed Settings Issues**:
  1. **Unlabeled Size Controls**: All 4 text-size buttons display `"Aa"` with no visible label (`Small / Default / Large / XL`), making the active step and scale unclear without hovering or inspecting ARIA labels.
  2. **Missing Controls**: No `System` theme follow (`prefers-color-scheme`), no generation/engine settings (Context size, GPU offload, Flash Attention, KV Quantization, Temperature/Top-P/Repeat Penalty), and no data/cache/backup management.
- **About (`/about`)**: Clean centered mark, `NEURIX v1.0.1`, tagline, `Source Code` and `Privacy Policy` link rows, and author credit (`Made by Saqlain Abbas`). See [desktop-about.png](docs/mission/baseline/desktop-about.png).
