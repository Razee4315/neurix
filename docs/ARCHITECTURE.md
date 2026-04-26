# Neurix Architecture

This document explains the major technical choices behind Neurix and how
the pieces fit together. It exists so a new contributor can answer "why is
it built this way?" without reading the whole codebase.

## What Neurix is

A privacy-first, fully offline AI chat app that runs LLMs locally on the
user's device. No telemetry, no cloud inference, no account. Models are
downloaded once from HuggingFace and live entirely on disk.

Primary target is Android. Desktop (Windows/macOS/Linux) is supported via
the same Tauri build but is a secondary platform.

## Stack at a glance

| Layer       | Choice                       | Why                                                       |
| ----------- | ---------------------------- | --------------------------------------------------------- |
| Shell       | Tauri 2                      | One Rust binary across desktop + Android, small footprint |
| Frontend    | React 18 + TypeScript + Vite | Familiar, fast HMR, mature ecosystem                      |
| Styling     | styled-components + tokens   | Co-located styles, themable, no Tailwind footprint        |
| Routing     | react-router-dom (HashRouter)| HashRouter is required because Tauri serves over file://  |
| Inference   | Candle (HuggingFace's Rust)  | No Python runtime, ships as a single library              |
| Tokenizer   | `tokenizers` crate           | Same library HF uses; supports all chat templates we need |
| Persistence | tauri-plugin-store + JSON    | Fine for current scale; SQLite is a future swap           |

## Why Tauri (not Electron, not React Native)

- **Electron** ships Chromium with the app. ~120 MB before any code runs.
  We need every megabyte of the APK budget for the model loader and
  initial chrome — not for a browser engine.
- **React Native** would force a rewrite of the UI in native primitives
  and means two separate code paths for Android vs desktop.
- **Tauri** uses the OS WebView (WKWebView on iOS/macOS, WebView2 on
  Windows, WebView on Android) so the binary stays small (~15 MB base)
  and we get a single React codebase.

## Why Candle (not llama.cpp, not ONNX)

- **llama.cpp** is the obvious choice — battle-tested, fastest for many
  models. But its Android story requires JNI bindings or a C++ build
  pipeline. We avoid that complexity by staying in Rust.
- **ONNX Runtime** is heavy and the model conversion story is awkward
  for the GGUF/quantized weights we want to ship.
- **Candle** is HuggingFace's Rust-native ML framework. It loads GGUF
  files directly, runs on CPU, and slots into our existing Rust crate
  without FFI. Slower than llama.cpp on raw matmul throughput, but the
  developer experience trade-off is worth it for a small team.

## Threading and concurrency

- **Tauri commands** are async functions on a Tokio runtime owned by
  Tauri itself. We don't call `#[tokio::main]`.
- **Inference is CPU-bound** and would block the runtime. So inference
  runs on a `tokio::task::spawn_blocking` thread (`commands/chat_cmds.rs`).
  The async handler takes a brief lock to grab the loaded model handle,
  then releases it before kicking off the blocking task — this is
  important so a long generation doesn't hold the lock and starve other
  commands.
- **Rayon thread pool** is configured at startup (`lib.rs`):
  - On Android: 2 threads. Inference is memory-bandwidth-bound on mobile,
    not compute-bound, so more threads just contend for cache.
  - On desktop: auto-detect, capped at 4. Same reasoning.
- **Cancellation** flows through `tokio_util::sync::CancellationToken`.
  The frontend "Stop" button triggers it; the inference loop checks the
  token between tokens.

## Data flow for a chat message

```
User taps Send (ChatPage.tsx)
        ↓
chatService.runInference()  ── invoke() over Tauri IPC
        ↓
chat_cmds::run_inference (Rust, async)
        ↓ takes brief Mutex lock on app state to clone model handle
        ↓ releases lock
        ↓
spawn_blocking { inference::engine::generate() }  ── CPU work
        ↓ emits TokenGenerated events through a Channel
        ↓
Channel<InferenceEvent>  ── back to frontend over IPC
        ↓
ChatPage handleEvent  ── appends to streamedText
```

The Channel is one-shot per call — frontend creates it, backend writes,
frontend reads in `chatService` and dispatches to a handler.

## Storage model

Currently flat JSON via `tauri-plugin-store`:

- **settings**: a single object. Small, rewritten on every change.
- **chat history**: a list of conversations, each with a list of messages.
  Loaded fully on history page, queried by id when reopening.

This is fine for the current scale. **Threshold to swap to SQLite
(via tauri-plugin-sql with FTS5)**: once history search becomes the
bottleneck, or users routinely have 1000+ conversations. Until then, the
simplicity of "read JSON, mutate, write JSON" wins.

## Network policy

The app only ever talks to `huggingface.co`, and only for two reasons:

1. Downloading a GGUF model file the user explicitly chose.
2. Downloading the matching `tokenizer.json`.

Both are gated by a WiFi-only check (in `DownloadContext`) that fails
closed — if we cannot determine the network type, we block. Users can
turn off the WiFi-only setting if they want to download over cellular.

The CSP in `tauri.conf.json` enforces this: only `huggingface.co` is on
the `connect-src` allowlist.

## Why `withGlobalTauri: true`

Set in `tauri.conf.json`. This exposes `window.__TAURI__` so debugging
in the Android WebView is easier — you can poke at IPC from the
inspector. There's no security cost because the CSP and capabilities
already constrain what's reachable.

## File layout

```
src/                  React frontend
  components/         Reusable UI bits (layout, buttons, dialogs)
  context/            React contexts (App state, Downloads, Toast, Confirm)
  pages/              One file per screen
  services/           Thin wrappers around Tauri invoke() calls
  theme/              Design tokens + GlobalStyles
  utils/              Pure helpers (with tests)

src-tauri/            Rust backend
  src/
    commands/         Tauri command handlers (the IPC surface)
    inference/        Candle wrappers, KV cache, sampling
    models/           Catalog, downloader, GGUF magic-byte verify
    chat/             Chat history storage
    state.rs          App-wide async state (Mutex<LoadedModel>)
    lib.rs            Tauri builder; thread-pool config; logger init
  Cargo.toml

dist/                 Build output (gitignored)
docs/                 This file and any future ADRs
```

## Things we deliberately do NOT do

- **No telemetry, no analytics, no crash reporting.** If we ever want
  these, they must be opt-in and locally-aggregated first.
- **No third-party model hosts.** Only HuggingFace, only over HTTPS.
- **No background sync.** All network activity is initiated by an
  explicit user action.
- **No login, no cloud account.** State lives on the device.

## Future swaps (not committed yet)

- **SQLite for history** when JSON read/write becomes a hotspot.
- **arm64-v8a-only APK split** to drop the multi-arch overhead.
- **Optional GPU inference** via Candle's CUDA/Metal/Vulkan backends —
  desktop only, off by default.
