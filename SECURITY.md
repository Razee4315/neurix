# Security Policy

## Neurix Security Model

Neurix is designed with privacy as a core principle:

- **All inference runs on-device** — no data is sent to external servers
- **No accounts or authentication** — nothing to compromise
- **No telemetry or analytics** — no tracking of any kind
- **Conversations stored locally** — as JSON inside the app's data directory
  (`%APPDATA%` on Windows, app-private storage on Android). The data is not
  encrypted by Neurix itself; it is separated from other apps by the
  operating system's per-user and per-app sandboxing. Full-disk encryption,
  where the OS offers it, protects it at rest.
- **Models downloaded over HTTPS** — from HuggingFace, and verified against
  a SHA-256 checksum pinned in the app's catalog before a file becomes a
  model the app will load.
- **Least-privilege webview** — the UI layer has no direct file-system or
  network capability; backup import/export run through native dialogs in
  the Rust backend.

## Automated Scanning

Every pull request runs a security workflow (`.github/workflows/security.yml`)
with dependency audits (npm and RustSec), CodeQL static analysis, Semgrep,
and gitleaks secret scanning over the full git history.

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.5.x   | Yes       |
| < 0.5   | No        |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public issue
2. Email the maintainer or open a private security advisory on GitHub
3. Include steps to reproduce the vulnerability
4. Allow reasonable time for a fix before public disclosure

We take security seriously and will respond as quickly as possible.

## Scope

The following are in scope:
- Vulnerabilities in the Neurix application code (Rust backend, React frontend)
- Issues with how models or conversations are stored on disk
- Network security issues in the model download pipeline
- Tauri permission/capability misconfigurations

The following are out of scope:
- Vulnerabilities in third-party models themselves
- Issues in upstream dependencies (report those to the respective projects)
- Social engineering attacks
