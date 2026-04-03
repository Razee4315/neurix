<div align="center">

<img src="src-tauri/icons/icon.png" alt="Neurix Logo" width="120" />

# Neurix

**Your AI. Your phone. No cloud. No subscription. No limits.**

Run powerful 1B language models directly on your Android device — fully offline, completely private.

[![Release](https://img.shields.io/github/v/release/Razee4315/neurix?style=flat-square)](https://github.com/Razee4315/neurix/releases)
[![Build](https://img.shields.io/github/actions/workflow/status/Razee4315/neurix/ci.yml?style=flat-square)](https://github.com/Razee4315/neurix/actions)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-orange?style=flat-square)](https://tauri.app)

**Android** · **Windows** · **macOS** · **Linux**

</div>

---

## Why Neurix

Every AI app today requires an internet connection, sends your data to remote servers, and charges a subscription fee.

People in regions with unreliable connectivity — Pakistan, India, Africa — have no good alternative. Privacy-conscious users who don't want their conversations uploaded to the cloud have no good alternative.

Neurix removes that dependency entirely.

Download a model once. Use it forever. No Wi-Fi required. No account. No one watching.

---

## Overview

Neurix is the first on-device LLM app built with **Tauri 2.0 mobile** — a brand new mobile framework powered by Rust. The result is a lightweight, fast app with a tiny install footprint compared to alternatives built on Flutter or React Native.

You open the app, browse a curated list of 1B parameter models, tap download, and within minutes you have a fully working AI assistant running locally on your phone.

---

## Features

- **On-device inference** — AI runs entirely on your phone's CPU/GPU, no server involved
- **One-tap model download** — curated list of small, capable 1B models
- **Offline after download** — use anywhere, anytime, no internet needed
- **Private by design** — conversations never leave your device
- **Model manager** — download multiple models, switch between them, delete to free space
- **Clean chat interface** — fast, distraction-free, optimized for mobile
- **Built with Rust** — lightweight binary, minimal memory footprint

---

## Installation

Download the latest release for your platform:

- **Android**: `.apk` (sideload) or `.aab` (Play Store)
- **Windows**: `.exe` installer or `.msi`
- **macOS**: `.dmg`
- **Linux**: `.AppImage` or `.deb`

See [Releases](https://github.com/Razee4315/neurix/releases) for all downloads.

---

## Development

### Requirements

- Node.js 18+
- Rust 1.77+
- Tauri CLI v2
- Android SDK (for Android builds)

### Run Locally

```bash
git clone https://github.com/Razee4315/neurix.git
cd neurix
npm install
npx tauri dev
```

### Android

```bash
npm run android:init
npm run tauri:android
```

### Build

```bash
npx tauri build             # Desktop
npm run build:android       # Android APK/AAB
```

### Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server at localhost:1420 |
| `npx tauri dev` | Desktop app (dev mode) |
| `npm run tauri:android` | Android device or emulator |
| `npm run build:android` | Android APK/AAB release |
| `npm run lint` | Biome lint |
| `npm run format` | Biome format |
| `npm run test` | Vitest unit tests |

---

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Tauri 2.0 |
| Backend | Rust |
| Frontend | React 18 + TypeScript |
| Styling | styled-components 6 |
| Build | Vite 4 |
| Linting | Biome |

---

## License

This project is licensed under the **MIT License**. See [LICENSE](LICENSE) for details.

---

## Author

**Saqlain Razee**

- GitHub: https://github.com/Razee4315
- LinkedIn: https://linkedin.com/in/saqlainrazee
