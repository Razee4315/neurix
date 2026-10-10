<div align="center">

<img src="src-tauri/icons/icon.png" alt="Neurix Logo" width="120" />

# Neurix

**Your AI. Your phone. No cloud. No subscription. No limits.**

Run powerful language models directly on your device — fully offline, completely private.

[![Release](https://img.shields.io/github/v/release/Razee4315/neurix?style=flat-square)](https://github.com/Razee4315/neurix/releases)
[![Build](https://img.shields.io/github/actions/workflow/status/Razee4315/neurix/ci.yml?style=flat-square)](https://github.com/Razee4315/neurix/actions)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-orange?style=flat-square)](https://tauri.app)

**Android** · **Windows**

</div>

---

## The Story Behind Neurix

I'm from Skardu, a small town in the mountains of northern Pakistan. It's one of the most beautiful places on earth — surrounded by peaks, glaciers, and valleys that stretch for miles.

It's also a place where internet is a luxury, not a given.

When you drive out toward Deosai or up the road to Shigar, the signal drops. Sometimes for hours, sometimes for days. If you're trekking to a base camp or traveling through one of the many valleys, there is no connectivity at all. No cellular data, no Wi-Fi, nothing.

I relied on ChatGPT and Claude for everything — writing, coding, brainstorming, translating. But every time I left town, I lost access to all of it. And it's not just Skardu. Millions of people across remote regions — in the mountains, in rural areas, in places where infrastructure hasn't caught up — face the same problem. You're cut off from the tools that have become essential to how we work and think.

That's why I built Neurix.

Download a model once over Wi-Fi. Use it forever. On a bus through the Karakoram Highway, in a village with no cell tower, on a flight, or just somewhere you'd rather not send your conversations to someone else's server.

No account. No subscription. No data leaving your device. Just you and your AI.

---

## What It Does

Neurix runs large language models entirely on your phone or desktop. No server, no API calls, no internet required after the initial model download.

- Open the app, pick a model from the store, tap download
- Once downloaded, the model runs locally using your device's hardware
- Chat with it like any AI assistant — it just happens to be running on your phone

---

## Screenshots

<div align="center">
<table>
<tr>
<td align="center"><img src="Screenshots/Model_Store.jpeg" width="260" /><br /><b>Model Store</b></td>
<td align="center"><img src="Screenshots/Download_page.jpeg" width="260" /><br /><b>Downloading</b></td>
</tr>
<tr>
<td align="center"><img src="Screenshots/Chat.jpeg" width="260" /><br /><b>Chat</b></td>
<td align="center"><img src="Screenshots/Chat_History.jpeg" width="260" /><br /><b>Chat History</b></td>
</tr>
<tr>
<td align="center"><img src="Screenshots/Setting_Page_1.jpeg" width="260" /><br /><b>Settings</b></td>
<td align="center"><img src="Screenshots/Setting_page_2.jpeg" width="260" /><br /><b>Inference Settings</b></td>
</tr>
</table>
</div>

---

## Features

- **On-device inference**: AI runs on your CPU through llama.cpp, no server involved
- **Current small models**: Qwen 3.5, LFM 2.5 and Gemma 4, from 640 MB to 5.2 GB
- **A pick for your device**: the store suggests a model from your device's memory and warns when one will not fit
- **Reasoning models**: optional "Think" mode, with the model's reasoning shown separately from its answer
- **Fast follow-ups**: the conversation stays in the model's memory, so a reply starts without re-reading the whole chat
- **Offline after download**: use anywhere, anytime, no internet needed
- **Private by design**: conversations never leave your device
- **Model manager**: download, switch, unload and delete models; warns when a model is too large for the device
- **Chat history**: auto-saved locally, searchable by title and message text
- **Characters**: built-in and custom personas, each with its own instructions, creativity, word variety and reply length
- **Themes**: four, each with its own typeface, shapes, texture and icon style: Obsidian (black glass, sharp cyan), Paper (serif ink on warm stock), Phosphor (amber terminal) and Dusk (soft and rounded). Four text sizes
- **Resume downloads**: pause and continue where you left off; every download is checked against a SHA-256 checksum. On Android a download keeps going while the app is in the background
- **Speed test**: measure tokens per second for any model on your own device
- **Backup**: export chats and custom characters to a file and import them on another device
- **Built with Rust**: lightweight, fast, minimal memory footprint

> The screenshots above predate the current interface and will be refreshed.

## Available Models

| Model | Download | Memory | Notes |
|-------|----------|--------|-------|
| Qwen 3.5 0.8B | 640 MB | 3 GB | Smallest; quick answers on almost any phone |
| LFM 2.5 1.2B | 840 MB | 3 GB | Built for phones; very fast |
| Qwen 3.5 2B | 1.3 GB | 4 GB | Best all-rounder; can reason on request |
| LFM 2.5 2.6B | 1.7 GB | 6 GB | Always reasons step by step before answering |
| Qwen 3.5 4B | 2.7 GB | 8 GB | Strongest for code and analysis on a phone |
| Gemma 4 E2B | 3.3 GB | 8 GB | Google's on-device model, official QAT build |
| Gemma 4 E4B | 5.2 GB | 12 GB | For computers and high-memory phones |

The catalog lives in [`src-tauri/src/models/catalog.rs`](src-tauri/src/models/catalog.rs).
Models from earlier versions (Llama 3.2, Qwen 2.5, Gemma 2, Phi-3.5, SmolLM2)
keep working if you already have them, but are no longer offered.

Any GGUF that llama.cpp supports can be added: the tokenizer and prompt
format are read from the model file itself.


-------|------|----------|
| Qwen 2.5 0.5B | 380 MB | Ultra-fast, basic tasks |
| Llama 3.2 1B | 700 MB | Quick tasks and chat |
| Qwen 2.5 1.5B | 940 MB | Multilingual, reasoning |
| SmolLM2 1.7B | 1.0 GB | General purpose |
| Gemma 2 2B | 1.5 GB | On-device optimized |
| Qwen 2.5 3B | 1.8 GB | Complex tasks |
| Llama 3.2 3B | 2.0 GB | Chat, reasoning, writing |
| Phi-3.5 Mini | 2.2 GB | Code generation |

All models use Q4_K_M quantization for the best balance of quality and size.

---

## Installation

### Android

1. Download the `.apk` from [Releases](https://github.com/Razee4315/neurix/releases)
2. Enable **Install unknown apps** in your Android settings
3. Tap the APK to install
4. Open Neurix, download a model, and you're set

### Windows

Download the `.msi` (recommended) or `.exe` from [Releases](https://github.com/Razee4315/neurix/releases).

---

## Development

### Prerequisites

- Node.js 18+
- Rust 1.77+
- Tauri CLI v2
- Android SDK + NDK (for Android builds)

### Run Locally

```bash
git clone https://github.com/Razee4315/neurix.git
cd neurix
npm install
npx tauri dev
```

### Android

```bash
npm run android:init    # First time only
npm run tauri:android   # Run on device/emulator
```

### Build

```bash
npx tauri build             # Desktop
npm run build:android       # Android APK/AAB
```

### Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server |
| `npx tauri dev` | Desktop app (dev mode) |
| `npm run tauri:android` | Android dev |
| `npm run build:android` | Android release build |
| `npm run lint` | Biome lint |
| `npm run typecheck` | TypeScript check |
| `npm run format` | Biome format |
| `npm test` | Run unit tests once (`npm run test:watch` to watch) |

`npm run dev` on its own opens the UI in a browser against an in-memory
stand-in for the Rust backend (`src/dev/mockTauri.ts`), which is handy for
working on screens without building the native app. It is never bundled in
production builds.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Tauri 2.0](https://tauri.app) |
| Backend | Rust + [llama.cpp](https://github.com/ggml-org/llama.cpp) (via [llama-cpp-2](https://github.com/utilityai/llama-cpp-rs)) |
| Frontend | React 18 + TypeScript |
| Styling | styled-components |
| Inference | GGUF quantized models |
| Build | Vite |

Neurix is one of the first apps built with Tauri 2.0's mobile support. The Rust backend runs models with llama.cpp, while the React frontend provides the UI. The Android install is about 15 MB before models. Android 9 or later is required.

---

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Security

See [SECURITY.md](SECURITY.md) for our security policy and how to report vulnerabilities.

## License

MIT License. See [LICENSE](LICENSE) for details.

---

<div align="center">

Built by [Saqlain Abbas](https://github.com/Razee4315)

</div>
