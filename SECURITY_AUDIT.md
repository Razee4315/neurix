# Neurix Security Audit — October 2026

Branch: `security/hardening-audit` (draft PR [#13](https://github.com/Razee4315/neurix/pull/13), not merged).
Scope: the entire repository — the Tauri app (`src/`, `src-tauri/`), the marketing website (`website/`), and CI/CD (`.github/workflows/`). The audit was authorized by the repository owner.

---

## 1. Summary

Neurix is a Tauri 2 desktop + Android app that runs LLM inference locally (llama.cpp). There is no server, no account system, and no telemetry: the entire attack surface is the local webview↔Rust IPC boundary, the model-download pipeline, user-supplied files (backups, shared characters, GGUF models), and the CI/CD pipeline.

**Overall risk: before HIGH → after LOW.**

The dominant risk was not any single bug but the *blast radius* the webview carried: the CSP allowed inline scripts, the full Tauri API was exposed globally, and the fs plugin granted **unscoped read/write of arbitrary files** to the webview layer. Any HTML injection (from a malicious model reply, a hostile backup file, or one compromised npm dependency) would have chained directly into reading or overwriting any file the user can access. Those three are now closed, the webview's remaining capabilities are scoped to `https://` URLs, and the download and import pipelines enforce size and integrity limits.

Everything else found was fixed in place (dependency CVEs, download caps, CI token scoping) or documented below for an owner decision where the fix would touch the release pipeline or be a product change.

| Severity | Before audit | After audit (this branch) |
|----------|--------------|---------------------------|
| Critical | 2 (npm, dev-only reachable) | 0 |
| High     | 4 | 0 |
| Medium   | 7 | 1 documented for decision (D-01, needs release-pipeline change) |
| Low      | 4 | 3 documented / accepted with rationale |
| Info     | 3 | 3 |

Automated scanning now runs on every pull request: `npm audit` (app + website), `cargo audit` (RustSec), gitleaks over the full git history, CodeQL (TypeScript, `security-extended`), and Semgrep. At the time of writing all of these are green, plus the existing CI (lint, 66 unit tests, type check, Rust tests + real-model end-to-end, Android build).

### What was verified and how

- Manual line-by-line review of all 326 tracked files that contain logic (all Rust commands, the inference engine, the download pipeline, storage, settings, all React pages/services, the Android bridge/service/manifest, all four workflows, and both lockfiles).
- The webview's *effective* permission set was verified against the generated ACL manifests (`src-tauri/gen/schemas/acl-manifests.json`), not just the capability file.
- Git history scanned for secret-like strings (targeted patterns locally; gitleaks full-history scan green in CI).
- Dependency audits: `npm audit` (0 findings), `cargo audit` (0 vulnerabilities; 17 unmaintained-crate warnings triaged in §5).
- Regression tests added for the backup format parser and download size limits; the existing 66 frontend unit tests and the Rust test suite run in CI.

---

## 2. Threat model

**Assets**

| Asset | Where it lives | Impact if compromised |
|-------|----------------|----------------------|
| Chat history + custom characters | JSON in app data dir | Privacy loss (most sensitive data the app holds) |
| Settings | tauri-plugin-store JSON | Tampering (e.g. prompt injection via system prompt) |
| Model files (GGUF, 0.6–5 GB) | app data dir / models | Arbitrary code in the inference engine (llama.cpp parses attacker-shaped input) |
| Installer / APK integrity | GitHub Releases | Supply chain to end users |
| CI secrets (Android keystore) | GitHub secrets | APK signing forgery |

**Trust boundaries**

1. Webview (renders model output, user text, imported files) ↔ Rust IPC commands.
2. App ↔ network: only `https://huggingface.co` (downloads happen in Rust, not the webview).
3. App ↔ filesystem: models, chats, settings, backup files.
4. User-supplied files: backup JSON, shared-character JSON, GGUF models.
5. CI ↔ repository: workflows, GITHUB_TOKEN, Android signing secrets.
6. Third-party code: npm and crates.io dependencies.

**Attacker types considered**

- **Anonymous network attacker** (MITM / DNS): HTTPS with rustls; catalog-pinned SHA-256 for all store models; magic-byte + size checks. Can at worst cause denial of service.
- **Malicious model author**: a GGUF whose *text output* is rendered by the webview (XSS attempt), or whose *binary structure* attacks llama.cpp. Output is rendered through a React-only markdown renderer with an `https?://`-only link regex — no `innerHTML` anywhere in the app. Binary structure is upstream llama.cpp's exposure (out of scope per SECURITY.md, catalog checksums limit replacement attacks).
- **Malicious file** (shared backup/character, or a picked file): the import paths validate ids, clamp string lengths, filter preset-id impersonation, cap size, and — after this audit — never let the webview touch the filesystem directly.
- **Logged-in user attacking their own app**: no multi-tenant surface exists; the realistic variant is social-engineering a user into importing a hostile backup, covered above.
- **Compromised dependency**: pinned lockfiles for both ecosystems; CI audits on every PR; actions pinned to commit SHAs in the new security workflow.
- **Local malware on the device**: out of scope — it can read the app's own files regardless of what Neurix does.

---

## 3. Where user data is created, read, stored, sent, or deleted

| Data | Created | Read | Stored | Transmitted | Logged | Deleted |
|------|---------|------|--------|-------------|--------|---------|
| Chat messages | ChatPage (typed) → `save_conversation` IPC | `load_conversation`, `search_conversations`, `export_data_to_file` | `chats/<uuid>.json` (plaintext, app data dir) | **Never leaves the device** (inference is local; export only via user-chosen file) | No | `delete_conversation`, `clear_all_conversations` (removes the files) |
| Custom characters | CharacterEditPage → `patch_settings` | picker, inference (system prompt), export | settings store JSON | never | No | via settings patch / import replace |
| Settings | `patch_settings`, `reset_settings` | `get_settings` at boot | settings store JSON | never | No | reset restores defaults |
| Models | `download_model` → HTTPS to huggingface.co | inference loader (memory-mapped) | `models/<catalog-id>/model.gguf` | download from HF only; checksum verified before rename | URL + id logged (no user content) | `delete_model` (catalog-id validated), cancel-with-discard |
| Backup files | `export_data_to_file` (Rust-side dialog) | `import_data_from_file` (Rust-side dialog, size-capped) | user-chosen location | never | No | managed by the user |
| Drafts / UI state | ChatPage, theme | on boot | `localStorage` | never | No | by the app |

---

## 4. Findings fixed on this branch

| ID | Title | Severity | CWE | Location (pre-fix) | Exploit scenario | Status | Fix commit |
|----|-------|----------|-----|--------------------|------------------|--------|------------|
| N-01 | Webview could read/write arbitrary files (fs plugin granted with no path scope) | **High** | CWE-732 / CWE-250 | `src-tauri/capabilities/main.json` (fs:allow-read/write-text-file); effective scope confirmed unscoped in `gen/schemas/acl-manifests.json` ("without any pre-configured scope") | Any script execution in the webview (chained from N-02, a malicious model reply, or one compromised npm package) calls `readTextFile("C:/Users/...")` via `window.__TAURI__` and exfiltrates every chat; `writeTextFile` plants files. No user interaction needed. | **Fixed** — export/import moved into Rust commands that own the native dialog and file IO (`export_data_to_file` / `import_data_from_file`); all fs and dialog JS capabilities removed; fs plugin kept as a Rust-only library (no IPC capability); Android `content://` still works via `Fs::open`. Tests for the parse path. | `b85ddc3`, `91b3979`, `5779a88` |
| N-02 | CSP allowed `script-src 'unsafe-inline'` | **High** | CWE-79 | `src-tauri/tauri.conf.json:21` | Tauri injects its runtime scripts with nonces/hashes; `unsafe-inline` bypasses that protection, so a single HTML injection anywhere in the webview (e.g. a hostile model reply if the markdown renderer is ever weakened) becomes script execution with IPC access. | **Fixed** — `script-src 'self'`; `style-src 'unsafe-inline'` kept (styled-components runtime `<style>`). `connect-src` narrowed to `'self' ipc: http://ipc.localhost` (the webview never fetches huggingface.co; the `ipc:` schemes future-proof the Linux build). | `a87b309` |
| N-03 | Full Tauri API exposed as `window.__TAURI__` | Medium | CWE-749 | `src-tauri/tauri.conf.json:6` (`withGlobalTauri: true`) | Gives injected/compromised scripts a ready handle to every IPC command (chained with N-01 pre-fix). Nothing in the codebase uses the global — the frontend imports the npm packages. | **Fixed** — `withGlobalTauri: false`. | `a87b309` |
| N-04 | Model download accepted unbounded data; oversized files passed verification | Medium | CWE-770 / CWE-409 | `src-tauri/src/models/download.rs` | A broken or hostile server (or a rerouted CDN) streams past the model's stated size and fills the disk; the post-download check only rejected *small* files, so oversized garbage with a GGUF header renamed into place. | **Fixed** — transfer aborts at `total + max(10%, 64 MB)` slack; `check_size` rejects both directions (unit tests). SHA-256 verification still runs after. | `ae05d10` |
| N-05 | 13 npm vulnerabilities (2 critical, 5 high) | Medium (dev-chain) | CWE-1104 | `package-lock.json` | Mostly dev toolchain (vite/vitest/babel/postcss); the two criticals were tinypool RCE reachable only by running untrusted test code; react-router open redirects unreachable (no untrusted links). Still: fixed, not argued away. | **Fixed** — react-router-dom 6→7, vitest 3→5, transitive bumps. `npm audit`: 13 → **0**. Lint, typecheck, and all 66 unit tests pass. | `9edb084` |
| N-06 | 18 RustSec vulnerabilities in the TLS/network stack | Medium | CWE-1104 | `src-tauri/Cargo.lock` | rustls/webpki/quinn/quick-xml DoS-class issues in the crates that terminate the app's only TLS connection (model downloads). | **Fixed** — lockfile-only updates: rustls 0.23.46, rustls-webpki 0.103.16, webpki-roots 1.0.11, quinn-proto 0.11.19, quick-xml 0.41.0 (via parent bumps notify-rust 4.18, plist 1.10). `cargo audit`: 18 → **0** vulnerabilities. | `699a843` |
| N-07 | CI ran with the repository's default (write-scoped) token; new actions tag-pinned | Medium | CWE-250 | `.github/workflows/ci.yml` (no `permissions:` block) | A compromised action or a script-injection bug in CI would run with a write-scoped token; tag-pinned actions are mutable upstream. The repo's default workflow permission is read/write (per `release.yml` setup notes). | **Fixed** — `ci.yml` declares `permissions: contents: read`. The new `security.yml` pins every third-party action to a commit SHA and uses least-privilege job permissions (`security-events: write` only where CodeQL needs it). Existing release/deploy workflows deliberately untouched (see D-01). | `faf1dff` |
| N-08 | Backup import had no size or memory bound | Low | CWE-409 | `src-tauri/src/commands/data_cmds.rs` | A hostile "backup" file shared socially and imported read whole into memory — a multi-GB file could exhaust the device. | **Fixed** — streamed read capped at 512 MB + 1 byte via `io::Read::take`; parse only after the cap check; format/version validated. Unit tests. | `91b3979` |
| N-09 | `opener:allow-open-url` granted without scope | Low | CWE-732 | `src-tauri/capabilities/main.json` | The webview could ask the OS to open *any* URL/scheme (e.g. `file:`, `ms-msdt:`, custom handlers). Both call sites only ever pass `https://` URLs, so the capability now enforces exactly that. | **Fixed** — `opener:default` (which bundles the unscoped grant) removed; scoped `https://**` allow-list added. | `b85ddc3` |
| N-10 | SECURITY.md overclaimed storage encryption | Low | CWE-1230 | `SECURITY.md` | Claimed chats are "encrypted at rest by the OS file system"; on default Windows/Android they are plaintext JSON behind OS sandboxing. A policy that overstates protection misleads security reviewers and users. | **Fixed** — accurate description + updated supported versions + documents the new scanning. | `fafb89a` |

Regression tests added: backup parser (garbage rejection, defaults, version preservation, size-limit sanity), download size check (both directions, absolute tolerance floor, slack bounds). The full pre-existing test suite (66 frontend tests, Rust unit tests, real-model end-to-end in CI) still passes; no test was weakened or deleted.

---

## 5. Triaged automated-scan results

**gitleaks (full history): clean.** No secrets in any commit.

**CodeQL (TypeScript, security-extended): clean.**

**npm audit (app + website): 0 findings** after N-05.

**cargo audit: 0 vulnerabilities; 17 unmaintained/notice warnings**, all in transitive dependencies (triaged, not suppressed):

| Warning | Why accepted |
|---------|--------------|
| `fxhash`, `proc-macro-error`, `unic-*`, `event-listener`, `anyhow` (advisory notices) | Unmaintained-crate notices inside proc-macro/build paths of llama.cpp and Tauri; no fix without upstream releases; not reachable with attacker-controlled input. |
| `glib 0.18` (RUSTSEC-2024-0429, unmaintained) | Part of the Linux/GTK stack pulled in by Tauri on Linux only; no Neurix code path uses it directly. |
| `rand 0.7/0.8/0.9` (RUSTSEC-2026-0097, unmaintained < 1.0) | Transitive (quinn/llama.cpp/aes stack). Not used for anything security-critical in Neurix (no tokens, no keys). Resolves upstream as parents move to rand 0.10/1.0. |
| `tokio 1.51` notice | Transitive notice; tracked by `cargo audit` on every PR — will surface again if it escalates to a vulnerability. |
| `zbus`/`zvariant` 5.x notices | Linux D-Bus stack via notify-rust (desktop notifications); unmaintained notices, no exploit path in Neurix. |

**Semgrep (`p/security-audit`, `p/secrets`): runs advisory** (`continue-on-error: true`) until its first findings are triaged; the first run was clean. Promote it to blocking by deleting the `continue-on-error` line in `security.yml` once the team is comfortable — noted as a next step.

---

## 6. Secrets that must be rotated

**None.** No hardcoded keys, tokens, or credentials were found in code, config, tests, or git history (targeted local scan + gitleaks full-history scan both clean). The Android signing keystore exists only as a GitHub Actions secret and is decoded at build time into a gitignored path — verify once in repo settings that `ANDROID_KEYSTORE_BASE64` / `ANDROID_KEY_ALIAS` / `ANDROID_KEY_PASSWORD` / `ANDROID_STORE_PASSWORD` are still considered current (rotation is your call; no exposure was found).

---

## 7. Items that need your decision

| ID | Item | Options |
|----|------|---------|
| **D-01** | `release.yml`, `android.yml`, `site.yml` pin actions to mutable tags (`actions/checkout@v4`, `dtolnay/rust-toolchain@stable`, `tauri-apps/tauri-action@v0`, …). A hijacked or force-moved tag runs arbitrary code with `secrets: inherit` access (Android keystore). **Deliberately not changed** — these are your release/deploy workflows and the rules for this audit said not to touch them. | Pin to commit SHAs exactly like `security.yml` does. Resolved SHAs as of this audit: `actions/checkout v7.0.1` → `3d3c42e5aac5ba805825da76410c181273ba90b1`, `actions/setup-node v7.1.0` → `949feb2413d6458794dcd2491c4babbbce0c15c1`, `taiki-e/install-action v2.87.30` → `a4d3f3f761dcd95cce1b72cb61cb6d1963438177`. For the rest, resolve with `gh api repos/<owner>/<repo>/commits/<tag> --jq .sha` and replace `@vX` with `@<sha> # vX`. |
| **D-02** | Legacy catalog models (Llama 3.2, Qwen 2.5, Gemma 2, Phi-3.5, SmolLM2) download with `sha256: None` and fall back to HuggingFace's ETag over TLS. | Accept (current state — HTTPS + ETag, back-compat for already-installed models), or pin checksums for the 8 legacy entries, or drop legacy support in a future major. |
| **D-03** | No auto-updater: users update by manually downloading installers/APKs, with no signature check beyond OS installer trust. | Adopt `tauri-plugin-updater` with signed manifests (desktop), and/or Play App Signing for Android. Product decision. |
| **D-04** | `vite.config.ts` dev server binds `0.0.0.0` (Tauri template default, needed for on-device Android testing). Dev-only; production bundles are unaffected. | Accept, or bind to `TAURI_DEV_HOST` only when explicitly set. |
| **D-05** | `release.yml` auto-bumps versions and pushes directly to `main` with a write-scoped token on every app change. | Leave as-is (working release automation), or gate releases behind a GitHub Environment with required reviewers. |

---

## 8. What was already good

Worth recording so future changes don't regress it:

- **IPC commands validate everything**: conversation ids are strict `[A-Za-z0-9_-]` (path-traversal tested), model ids must be catalog entries before any path join or delete, inference parameters are clamped server-side, settings pass a sanitize+clamp layer regardless of caller.
- **Atomic writes** for conversations (temp file + rename), keeping corrupt-chat states impossible on crash.
- **Download integrity**: HTTPS-only (rustls), catalog-pinned SHA-256 for all store models, GGUF magic-byte check, size checks, cancellation-aware resume.
- **No `innerHTML` / `dangerouslySetInnerHTML` / `eval` anywhere in the app**; model output goes through a React-node markdown renderer whose link regex only admits `https?://`; shared-character import validates icons against an allowlist and colors against `#rrggbb`.
- **Fail-closed WiFi-only logic on mobile**, re-enforced in Rust, not just the UI.
- Android: bridge exposes exactly two methods, service not exported, cleartext traffic disabled in release, `FLAG_IMMUTABLE` PendingIntent.
- Least-privilege defaults elsewhere: `site.yml` already scoped its permissions; secrets never enter fork PR runs.

---

## 9. Recommended next steps

1. **Decision on D-01 (pin release-workflow actions)** — highest-value remaining hardening, ~30 minutes.
2. **Smoke-test the app once** after this branch merges (open the app, chat, export + import a backup): the capability/CSP changes cannot be exercised by CI's compile-and-test jobs. If `withGlobalTauri: false` or the CSP ever surprises a plugin, the fallback is documented in the commit messages.
3. **Promote Semgrep to blocking** in `security.yml` (remove `continue-on-error`) after a week of green advisory runs.
4. **Consider CodeQL for Rust** in a scheduled (weekly, not per-PR) workflow — the full llama.cpp build makes it too heavy for every PR, but a weekly run adds depth beyond clippy.
5. **External review of llama.cpp exposure**: GGUF parsing is the one memory-unsafe surface Neurix feeds user-chosen files into. Keeping `llama-cpp-2` pinned exactly (as done) and tracking its releases is the right baseline; a fuzzing pass upstream would be the ideal next step.
6. **Dependabot** for npm + cargo would keep the audits green without manual sweeps (`versioning-strategy: lockfile-only` fits this repo).
7. **Backup encryption** (optional product feature): backups are plaintext JSON by design; an optional passphrase (age/XChaCha20) would protect users who store backups in shared cloud folders.

---

## 10. Verification checklist for this branch

- [x] `npm audit` (app + website): 0 findings
- [x] `cargo audit`: 0 vulnerabilities (17 warnings triaged above)
- [x] gitleaks full history: clean
- [x] CodeQL (TypeScript, security-extended): clean
- [x] Semgrep (advisory): clean on first run
- [x] Biome lint + `tsc --noEmit`: clean
- [x] 66 frontend unit tests: pass (incl. new regression tests)
- [x] Security workflow green on the branch
- [x] CI (frontend / engine incl. real-model end-to-end / Android build): green on the branch
- [x] `main` untouched; no tags or releases created; release/deploy workflows unmodified

*Report generated as part of the Phase 5 deliverable; commit hashes reference `security/hardening-audit`.*
