# Neurix — Full Implementation Plan

## Context

Neurix has 8 complete UI screens with mock data. The Rust backend is empty (just a `greet` command). We need to make everything functional: download real LLM models from Hugging Face, run inference on-device using Rust, stream tokens to the chat UI, persist conversations and settings. All processing must be local — no cloud APIs.

---

## Architecture Overview

```
React Frontend (UI pages)
  ↕ invoke() + Channel streaming
TypeScript Service Layer (src/services/)
  ↕ Tauri IPC
Rust Backend (src-tauri/src/)
  ├── Model Catalog (hardcoded list)
  ├── Model Download (HTTP + progress streaming)
  ├── Model Manager (load/unload/delete GGUF files)
  ├── Inference Engine (candle + GGUF → token generation)
  ├── Chat Storage (JSON files per conversation)
  └── Settings (plugin-store persistence)
```

---

## Phase 0: Scaffolding

**What:** Set up Rust module structure, add dependencies, create TS service layer skeleton.

### Rust Changes

**`src-tauri/Cargo.toml`** — Add dependencies:
```toml
candle-core = "0.9"
candle-transformers = "0.9"
candle-nn = "0.9"
tokenizers = { version = "0.21", default-features = false, features = ["onig"] }
uuid = { version = "1", features = ["v4", "serde"] }
chrono = { version = "0.4", features = ["serde"] }
anyhow = "1"
```

**Create Rust module tree:**
```
src-tauri/src/
  lib.rs              ← restructure: register state + all commands
  main.rs             ← unchanged
  state.rs            ← AppState (loaded model, active downloads, cancel tokens)
  settings.rs         ← Settings struct, read/write via plugin-store
  models/
    mod.rs
    catalog.rs        ← hardcoded model list with HF download URLs
    download.rs       ← HTTP download with Channel progress
    manager.rs        ← load/unload/list/delete models from disk
  inference/
    mod.rs
    engine.rs         ← GGUF loading, token generation loop
    sampler.rs        ← temperature, top-p, repetition penalty
  chat/
    mod.rs
    storage.rs        ← save/load conversations as JSON files
  commands/
    mod.rs
    model_cmds.rs     ← get_model_catalog, download_model, cancel_download, etc.
    chat_cmds.rs      ← run_inference, stop_inference
    history_cmds.rs   ← get/save/delete conversations
    settings_cmds.rs  ← get/update settings, get_storage_info
```

**Create frontend service layer:**
```
src/services/
  types.ts            ← TS types mirroring Rust structs
  modelService.ts     ← invoke wrappers for model commands
  chatService.ts      ← invoke wrappers for inference
  historyService.ts   ← invoke wrappers for conversation CRUD
  settingsService.ts  ← invoke wrappers for settings
  index.ts
```

**Create React context:**
```
src/context/
  AppContext.tsx       ← activeModel, settings, refresh functions
```

**`src-tauri/capabilities/main.json`** — Add missing FS permissions:
```
"fs:allow-write-file", "fs:allow-mkdir", "fs:allow-remove",
"fs:allow-exists", "fs:allow-read-dir", "fs:allow-stat"
```

**Verify:** `cargo check` in src-tauri/, `npx tsc --noEmit` in root.

---

## Phase 1: Settings & Persistence

**What:** Real settings that persist across restarts.

### Rust
- `settings.rs` — `Settings` struct (wifi_only, save_history, show_speed, system_prompt, temperature, top_p, max_tokens). Read/write via `tauri-plugin-store` using `settings.json`.
- `state.rs` — `AppState` struct with `Mutex<>`. Fields: `loaded_model: Option<LoadedModel>`, `active_downloads: HashMap<String, CancellationToken>`, `inference_cancel: Option<CancellationToken>`.
- `commands/settings_cmds.rs` — `get_settings`, `update_settings`, `get_storage_info`.
- Update `lib.rs` — `.manage(Mutex::new(AppState::default()))`, register settings commands.

### Frontend
- `services/settingsService.ts` — `getSettings()`, `updateSettings(settings)`, `getStorageInfo()`.
- `context/AppContext.tsx` — Wrap app, load settings on mount.
- Update `SettingsPage.tsx` — Load real settings, save on change.

**Verify:** Toggle a switch, restart app, setting is preserved.

---

## Phase 2: Model Catalog & Downloads

**What:** Browse real models, download GGUF files with real progress.

### Model Catalog (hardcoded v0.1)

| Model | GGUF File | Size | Tag |
|-------|-----------|------|-----|
| Llama 3.2 1B | `bartowski/Llama-3.2-1B-Instruct-GGUF` | ~700 MB | Tiny |
| SmolLM2 1.7B | `bartowski/SmolLM2-1.7B-Instruct-GGUF` | ~1.0 GB | Popular |
| Gemma 2 2B | `bartowski/gemma-2-2b-it-GGUF` | ~1.5 GB | Fast |
| Llama 3.2 3B | `bartowski/Llama-3.2-3B-Instruct-GGUF` | ~2.0 GB | Popular |
| Phi-3.5 Mini | `bartowski/Phi-3.5-mini-instruct-GGUF` | ~2.2 GB | Code |

Each entry: `ModelInfo { id, name, description, size_bytes, size_label, tag, hf_repo, hf_filename, tokenizer_repo, chat_template }`.

HF download URL pattern: `https://huggingface.co/{repo}/resolve/main/{filename}`

### Rust
- `models/catalog.rs` — Return hardcoded `Vec<ModelInfo>`.
- `models/download.rs` — Stream download via `reqwest` (already a transitive dep from tauri-plugin-http). Progress sent via `Channel<DownloadEvent>`. Files saved to `{app_local_data}/models/{model_id}/model.gguf` + `tokenizer.json`. Uses `.part` suffix during download. Supports cancellation via `CancellationToken`.
- `commands/model_cmds.rs` — `get_model_catalog`, `download_model(model_id, on_event: Channel)`, `cancel_download(model_id)`.

### Download Event (Channel)
```rust
enum DownloadEvent {
  Started { total_bytes: u64 },
  Progress { bytes_downloaded: u64, total_bytes: u64, speed_bps: u64 },
  Finished,
  Failed { error: String },
  Cancelled,
}
```

### Frontend
- `services/modelService.ts` — `getCatalog()`, `downloadModel(id, onEvent)`, `cancelDownload(id)`.
- Update `ModelStorePage.tsx` — Fetch catalog, show "Downloaded" badge for existing models, navigate to downloading on tap.
- Update `DownloadingPage.tsx` — Accept model via route state, show real progress from Channel, wire cancel button.

**Verify:** Download a real 700MB model, see real speed/progress, cancel mid-download.

---

## Phase 3: Model Management

**What:** List downloaded models, switch active model, delete models.

### Rust
- `models/manager.rs` — Scan `models/` dir for downloaded models, delete model directory, load GGUF into memory (candle), unload model.
- `commands/model_cmds.rs` — `get_downloaded_models`, `delete_model(id)`, `load_model(id)`, `get_active_model`.

### Frontend
- Update `MyModelsPage.tsx` — Real model list, real storage bar, working "Use Model" (calls `loadModel`), working delete (with confirmation dialog via `plugin-dialog`).

**Verify:** Downloaded models show up, switch between them, delete frees space.

---

## Phase 4: Inference Engine (Critical Path)

**What:** Load GGUF model with candle, generate tokens, stream to chat.

### Rust
- `inference/engine.rs`:
  1. **Load:** `gguf_file::Content::read()` → `quantized_llama::ModelWeights::from_gguf()` + `Tokenizer::from_file()`. Store in `AppState.loaded_model`.
  2. **Generate:** Encode prompt with chat template → forward pass → sample next token → decode → send via `Channel<InferenceEvent>` → check `CancellationToken` → repeat until EOS or max_tokens.
- `inference/sampler.rs` — Temperature, top-p, repetition penalty on logits.
- `commands/chat_cmds.rs` — `run_inference(prompt, system_prompt, on_event: Channel)`, `stop_inference`.

### Inference Event (Channel)
```rust
enum InferenceEvent {
  TokenGenerated { token: String, tokens_per_second: f32 },
  GenerationComplete { total_tokens: usize, duration_ms: u64 },
  Error { message: String },
}
```

### Chat Template Formatting
Each model family needs its prompt format:
- **Llama 3:** `<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n{system}<|eot_id|><|start_header_id|>user<|end_header_id|>\n{user}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n`
- **SmolLM/Phi:** Similar instruction-following format
- **Gemma:** `<start_of_turn>user\n{msg}<end_of_turn>\n<start_of_turn>model\n`

### Frontend
- Rewrite `ChatPage.tsx`:
  - Remove ALL mock data.
  - State: `messages[]`, `isGenerating`, `streamedText`, `tokensPerSecond`.
  - On send: append user msg, call `runInference()` with Channel listener.
  - On each `tokenGenerated`: append to growing AI bubble in real-time.
  - On `generationComplete`: finalize message, show tok/s if setting enabled.
  - Stop button: calls `stopInference()`.
  - Handle "no model loaded" state → prompt user to go to Models page.

**Verify:** Type a prompt, see tokens appear one-by-one, stop mid-generation, try different models.

---

## Phase 5: Chat History

**What:** Persist conversations, load previous chats.

### Rust
- `chat/storage.rs` — Each conversation is a JSON file at `{app_local_data}/chats/{uuid}.json`. Contains: `Conversation { id, title, model_id, model_name, created_at, updated_at, messages[] }`. Functions: list (metadata only), load (full), save, delete, clear all.
- `commands/history_cmds.rs` — `get_conversations`, `save_conversation`, `delete_conversation`, `clear_all_conversations`.

### Frontend
- `services/historyService.ts`.
- Update `ChatPage.tsx` — Auto-save after each exchange, track `conversationId`, "New chat" creates fresh conversation.
- Update `ChatHistoryPage.tsx` — Real conversation list grouped by date, load full chat on tap, working "Clear all".

**Verify:** Chat persists across app restarts, history shows real conversations.

---

## Phase 6: Wire Remaining UI

**What:** Connect all loose ends.

- **Splash Screen** — Check if any model is downloaded. If yes → skip to `/chat`. If no → `/onboarding`.
- **Onboarding** — After completion, go to `/store` (first time) or `/chat` (if model exists).
- **Model Store** — Show "Downloaded" badge on already-downloaded models. Disable download button for them.
- **Downloading** — Navigate to `/models` on completion (not just cancel).
- **My Models** — "Use Model" loads model and navigates to `/chat`.
- **AppContext** — Track `activeModel` globally, show in Chat page header.

---

## Phase 7: Android Build

1. `npx tauri android init` → generates `src-tauri/gen/android/`
2. `rustup target add aarch64-linux-android armv7-linux-androideabi`
3. Set up Android NDK env vars
4. Add `.gitignore` exception for `src-tauri/gen/android/`
5. Configure signing in `app/build.gradle.kts`
6. Build: `npx tauri android build --target aarch64`
7. Test on physical device
8. Profile: memory usage, inference speed, download behavior

---

## Key Technical Notes

- **State management:** `tauri::State<tokio::sync::Mutex<AppState>>` — must use tokio Mutex (not std) because async commands hold lock across await points.
- **Model loading time:** 2-5 seconds for 2GB GGUF. Show loading spinner in UI. Model stays in memory until replaced.
- **Memory:** Q4_K_M 3B model uses ~2GB RAM. Check available RAM before loading.
- **Inference speed:** Expect 5-15 tok/s on modern Android phones (CPU only, no GPU).
- **Downloads:** Use `.part` suffix during download, rename on completion. Store in `AppLocalData/models/`.
- **Conversations:** Individual JSON files (not plugin-store) to avoid single-file bottleneck.
- **Why candle over llama.cpp:** Pure Rust = clean cross-compilation to Android ARM64. No C++ NDK complexity.

---

## Files to Modify

| File | Change |
|------|--------|
| `src-tauri/Cargo.toml` | Add candle, tokenizers, uuid, chrono, anyhow |
| `src-tauri/src/lib.rs` | Restructure: modules, managed state, all commands |
| `src-tauri/capabilities/main.json` | Add fs write/mkdir/remove/exists/stat permissions |
| `src/pages/ChatPage.tsx` | Biggest rewrite: real inference streaming |
| `src/pages/ModelStorePage.tsx` | Real catalog + download flow |
| `src/pages/DownloadingPage.tsx` | Real progress from Channel |
| `src/pages/MyModelsPage.tsx` | Real model list + switch/delete |
| `src/pages/ChatHistoryPage.tsx` | Real conversation list |
| `src/pages/SettingsPage.tsx` | Real persistence |
| `src/pages/SplashScreen.tsx` | Smart routing based on state |
| `src/App.tsx` | Wrap with AppContext |

**New files:** ~15 Rust files (modules), ~6 TS service files, 1 context file.

---

## Verification

After each phase:
1. `cargo check` in src-tauri/ (Rust compiles)
2. `npx tsc --noEmit` (TypeScript compiles)
3. `npm run build` (full build passes)
4. `npx tauri dev` (app runs, feature works end-to-end)

Final: Download a model → load it → chat with real inference → close app → reopen → conversation persists → settings persist.
