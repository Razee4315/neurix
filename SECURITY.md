# Security Policy

## Neurix Security Model

Neurix is designed with privacy as a core principle:

- **All inference runs on-device** — no data is sent to external servers
- **No accounts or authentication** — nothing to compromise
- **No telemetry or analytics** — no tracking of any kind
- **Conversations stored locally** — encrypted at rest by the OS file system
- **Models downloaded over HTTPS** — from HuggingFace's CDN

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | Yes      |

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
