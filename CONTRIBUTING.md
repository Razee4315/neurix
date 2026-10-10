# Contributing to Neurix

Thanks for your interest in contributing to Neurix. This guide will help you get started.

## Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/your-username/neurix.git
   cd neurix
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Run the development server:
   ```bash
   npx tauri dev
   ```

## Prerequisites

- Node.js 18+
- Rust 1.77+
- Tauri CLI v2 (`cargo install tauri-cli`)
- Android SDK + NDK (for mobile builds)

## Project Structure

```
src/                  # React frontend (TypeScript)
  pages/              # Page components
  components/         # Reusable UI components
  context/            # React context providers
  services/           # Tauri IPC service layer
  theme/              # Design tokens and theme

src-tauri/            # Rust backend
  src/commands/       # Tauri IPC command handlers
  src/inference/      # Model loading and token generation
  src/models/         # Model catalog, download, management
  src/chat/           # Chat history storage
```

## Development Workflow

1. Create a feature branch from `main`:
   ```bash
   git checkout -b feature/your-feature
   ```

2. Make your changes. Run lint and type checks:
   ```bash
   npm run lint
   npm run typecheck
   npm test
   cargo check --manifest-path src-tauri/Cargo.toml
   ```

3. Test on desktop:
   ```bash
   npx tauri dev
   ```

4. Commit with a clear message describing what changed and why.

5. Open a pull request against `main`.

## Code Style

- **Frontend**: Biome handles formatting and linting. Run `npm run format` before committing.
- **Backend**: Standard Rust formatting. Run `cargo fmt` in `src-tauri/`.
- Keep components small and focused.
- Avoid unnecessary abstractions.

## Reporting Issues

Open a GitHub issue with:
- Steps to reproduce
- Expected vs actual behavior
- Device/OS info (especially for Android issues)
- Screenshots if relevant

## Adding New Models

To add a model to the catalog, edit `src-tauri/src/models/catalog.rs`. Requirements:
- A GGUF file on HuggingFace that can be downloaded without logging in
- An architecture the bundled llama.cpp supports (it loads the file, or it does not; the CI engine test will tell you)
- A chat template inside the GGUF. Nothing is hand-written per model: the tokenizer and the prompt format are both read from the file
- The exact file size and its SHA-256 (the LFS `oid` shown on the file's HuggingFace page), so the download can be verified
- An honest `min_ram_gb`, and `quality` / `speed` ratings relative to the rest of the catalog

To check a model end to end before opening a pull request:

```bash
cd src-tauri
NEURIX_TEST_MODEL=/path/to/model.gguf cargo test real_model_end_to_end -- --ignored --nocapture
```

Mirror the entry in `src/dev/mockTauri.ts` so the browser preview shows it too.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
