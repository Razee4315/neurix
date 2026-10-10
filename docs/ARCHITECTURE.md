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
| Inference   | llama.cpp (`llama-cpp-2`)    | Fastest CPU inference; supports new models as they ship    |
| Prompts     | `minijinja`                  | Renders the chat template stored in each GGUF              |
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

## Why llama.cpp

Neurix first shipped on Candle, HuggingFace's Rust ML framework, to avoid a
C++ build. That trade stopped paying for itself:

- **Every new architecture needed a hand-written loader.** Gemma 4 and
  Qwen 3.5 could not be loaded at all. llama.cpp supports new models within
  days of release, and the GGUF files people publish are made for it.
- **Speed.** llama.cpp has tuned kernels for the instruction sets phones
  actually have (ARM dot-product), memory-maps the model file, and keeps a
  conversation's processed tokens between messages.
- **Correctness.** Candle needed a separate `tokenizer.json` and a prompt
  format written by hand for each model family, and those were wrong in
  several places (a doubled start token, the wrong end-of-turn token).
  llama.cpp reads the tokenizer from the GGUF.

The cost is a C++ build (CMake, clang for bindgen, the Android NDK). That
cost is paid in CI: nothing needs to be compiled on a developer machine to
get a build (see *Building* below).

llama.cpp is used through the `llama-cpp-2` crate, pinned to an exact
version because the crate tracks llama.cpp closely and its API moves.

## Prompt format

Each GGUF carries the Jinja chat template its model was trained with.
`inference/template.rs` renders that template with `minijinja` (plus the
Python string/dict methods templates rely on). No prompt format is written
by hand, so a model added to the catalog needs no engine change.

The templates in the wild use a few things plain Jinja does not have:
`raise_exception`, `strftime_now`, and Hugging Face's `{% generation %}`
tag. Those are provided or stripped in the same file. If a GGUF has no
template at all, ChatML is used.

## Conversation memory

The context is kept between messages together with the exact list of
tokens it holds (`LoadedModel::cached`). For a new prompt the engine finds
the longest shared prefix, drops what follows it, and decodes only the
rest.

Hybrid and recurrent models (Qwen 3.5, LFM 2) cannot drop the tail of what
they have read: their state is one running summary, not a list of
per-token entries. For those the engine saves a snapshot of the state at
the end of the conversation text, before the "assistant starts here"
marker, and rewinds to the snapshot instead. The next prompt always starts
with exactly that text, so a follow-up costs the previous reply plus the
new message, not the whole chat. This is the same approach as llama.cpp's
own server (context checkpoints).

When the conversation outgrows the context window the oldest exchanges are
dropped. The cut is made well below the limit and remembered per
conversation, so it does not move on the next turn; moving it would change
the start of the prompt and throw the cache away every time.

## Reasoning models

Some models write out their thinking before the answer, between marker
tags (`<think>…</think>`, or Gemma's channel tags). `inference/stream.rs`
splits the token stream into reasoning and answer, and the two are sent to
the UI as separate events. Reasoning is stored with the message and shown
collapsed; it is never sent back to the model.

Whether a model can be asked to think is read from its template (the
`enable_thinking` switch), not assumed from the catalog.

## Stopping

Generation ends at the model's end-of-generation token (as defined in the
GGUF), at the reply limit, when the context is full, or when the user
stops it. The only heuristic is a guard against a model stuck in an exact
loop for 256 tokens. Earlier versions also stopped on short repeated
patterns and on low-confidence tokens; those cut off tables, code and
lists, and were removed.

## Threading and concurrency

- **Tauri commands** are async functions on a Tokio runtime owned by
  Tauri itself. We don't call `#[tokio::main]`.
- **Inference is CPU-bound** and would block the runtime. So inference
  runs on a `tokio::task::spawn_blocking` thread (`commands/chat_cmds.rs`).
  The async handler takes a brief lock to check the model out of the app
  state, then releases it before kicking off the blocking task — this is
  important so a long generation doesn't hold the lock and starve other
  commands.
- **Thread count** comes from `device.rs`. Phone chips mix fast and slow
  cores, and a thread on a slow core holds the others back, so only the
  fast cores are counted (from the scheduler's `cpu_capacity`, falling
  back to clock speed). Desktops use the physical core count. The user can
  override it in Settings.
- **Cancellation** flows through `tokio_util::sync::CancellationToken`.
  The frontend "Stop" button triggers it; the engine checks it between
  tokens and between batches while reading the prompt.

## Data flow for a chat message

```
User taps Send (ChatPage.tsx)
        ↓
chatService.runInference()  ── invoke() over Tauri IPC
        ↓
chat_cmds::run_inference (Rust, async)
        ↓ takes a brief Mutex lock to check the model out of app state
        ↓ releases the lock
        ↓
spawn_blocking { LoadedModel::generate() }  ── CPU work
        ↓ renders the chat template, trims history to fit
        ↓ decodes only the tokens the context has not seen
        ↓ emits PromptProgress / ReasoningGenerated / TokenGenerated
        ↓
Channel<InferenceEvent>  ── back to frontend over IPC
        ↓
ChatPage handleEvent  ── appends to the streamed reply
```

The Channel is one-shot per call — frontend creates it, backend writes,
frontend reads in `chatService` and dispatches to a handler.

## Storage model

Currently flat JSON:

- **settings**: a single object in `tauri-plugin-store`. Every writer goes
  through `settings::patch`, which merges only the keys it is given under a
  lock. The frontend sends partial changes (`patch_settings`), never the
  whole object, so a stale copy held in the UI cannot overwrite a field the
  backend set in the meantime (e.g. `last_model_id` on model load). An
  unreadable value is backed up and replaced with defaults.
- **chat history**: one JSON file per conversation. Listing deserialises
  only the header fields (serde skips the messages); search reads message
  text. Saves are written to a temp file and renamed, and keep the original
  `created_at`.

The model selected for chat is tracked separately from the loaded weights
(`AppState.active_model` vs `loaded_model`): the weights are checked out of
the state for the duration of a reply, and the UI must still see the model
as active then.

This is fine for the current scale. **Threshold to swap to SQLite
(via tauri-plugin-sql with FTS5)**: once history search becomes the
bottleneck, or users routinely have 1000+ conversations. Until then, the
simplicity of "read JSON, mutate, write JSON" wins.

## Network policy

The app only ever talks to `huggingface.co`, and only to download a GGUF
model file the user explicitly chose. The file is self-contained: weights,
tokenizer and chat template.

On phones and tablets the download is gated by a WiFi-only check (in
`DownloadContext`, re-checked in `download_model`) that fails closed — if
we cannot determine the network type, we block and say why. The user can
go ahead on the current connection from the same screen, or turn the
setting off. Desktop WebViews do not report a
connection type and have no metered-data concept here, so desktop builds
are exempt.

A finished download is verified before it is installed: size, GGUF magic
bytes, and SHA-256 against the checksum pinned in the catalog (older
catalog entries fall back to the hash HuggingFace sends in its headers).

On Android a foreground service (`DownloadService.kt`) keeps the process
alive while a download runs, so it continues with the app in the
background. The service does no work itself; the download is the same
Rust code. The web layer starts and stops it through a small JavaScript
interface, `window.NeurixAndroid`.

## Theming

Colors are CSS variables. `theme/themes.ts` defines each theme as a set of
hex values per color role; `applyTheme` writes them to `:root` as RGB
triplets (`--c-primary: 143 245 255`), and `tokens.colors.*` are static
strings (`rgb(var(--c-primary))`). Translucent variants go through
`alpha(color, "1f")` rather than string concatenation. Icons are inline
SVGs from `lucide-react`, looked up by name in `components/ui/Icon.tsx`.

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
    inference/        llama.cpp engine, chat templates, reply stream filter
    device.rs         RAM and CPU-core detection
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

## Building

`llama.cpp` is compiled from source by the `llama-cpp-sys-2` build script,
which needs CMake and libclang, plus the Android NDK for a phone build.
None of that has to be installed locally:

- **CI** (`.github/workflows/ci.yml`) runs on every pull request. It runs
  the Rust tests, then runs the engine end to end against two real models
  (a plain transformer and a hybrid), and builds an Android APK that is
  attached to the run.
- **Releases** (`release.yml`) reuse the same Android workflow
  (`android.yml`).

The SIMD level is set in `src-tauri/.cargo/config.toml`: AVX2 on x86-64
desktops and ARMv8.2 dot-product on Android. Both are compile-time choices
in ggml, so the build does not run on CPUs older than that.

To run the engine test against a model on your own machine:

```bash
cd src-tauri
NEURIX_TEST_MODEL=/path/to/model.gguf cargo test real_model_end_to_end -- --ignored --nocapture
```

## Future swaps (not committed yet)

- **SQLite for history** when JSON read/write becomes a hotspot.
- **GPU inference.** llama.cpp has OpenCL (Adreno) and Vulkan backends.
  They need testing on real devices before shipping: a hard dependency on
  a GPU driver library can stop the app from starting on phones without it.
- **Image input.** The Qwen 3.5 and Gemma 4 repositories publish vision
  projector files; llama.cpp's `mtmd` library can use them.
- **A catalog fetched at runtime**, so adding a model does not need an app
  release.
