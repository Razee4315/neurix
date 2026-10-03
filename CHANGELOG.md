# Changelog

All notable changes to Neurix. Finding IDs (F-, M-, D-, C-, O-) refer to
[AUDIT_PROGRESS.md](AUDIT_PROGRESS.md).

## v0.4.0

A full pass over the app from a UX and code audit: chat reliability, honest
download states, keyboard access, a theme system and a visual refresh.

### Features
- Ten color themes, dark and light, with live previews, plus four text sizes [D-01, M-11]
- SVG icon set and illustrations for the splash screen, chat and empty states [D-02, D-03]
- Switch the loaded model from the chat header [M-07]
- Continue a reply that hit the length limit; the app says why a reply stopped early [F-13, M-03]
- Undo for deleted messages and conversations [M-05]
- Unsent messages are kept as a draft [M-04]
- History search covers message text, with snippets [F-24, M-06]
- Export and import a backup of chats and custom characters [M-09]
- Unload a model to free memory [M-10]
- Warning before downloading a model that is too large for the device's memory [M-01]
- A first install loads the model and opens chat directly [F-42]
- The walkthrough is shown once [M-12]

### Fixes
- Chats are saved as one conversation, every time [F-01]
- The loaded model is recognised after launch; no duplicate loads [F-03]
- Deleting a message or an error no longer makes the model forget earlier context [F-04]
- Leaving mid-reply keeps the partial reply in the same chat and respects "Save chat history" [F-05]
- A failed model load stays on the chat screen with Retry and keeps your message [F-08]
- If generation fails, the model is no longer lost from memory [F-09]
- Replies containing "user:" (YAML, code, prose) are no longer cut off [F-10]
- Starting a new chat mid-reply no longer leaks the old reply into it [F-11]
- You can type the next message while a reply is generating; Enter adds a line on touch keyboards [F-12]
- Copy and share report what actually happened [F-15]
- Settings changes no longer overwrite each other; the last-used model is remembered [F-21]
- Opening an old chat restores the character it was held with [F-26]
- Windows: WiFi-only no longer blocks downloads; on phones, a paused download says why [F-29]
- A failed tokenizer download is reported as a failure and retries without re-downloading the model [F-30]
- Deleting the model in use unloads it [F-31]
- Cancelling a download deletes the partial file; pausing keeps it [F-33]
- Downloads handle already-complete partial files, stall after 45 s without data, and show current speed [F-34]
- Interrupted downloads reappear as paused after a restart [F-35]
- Settings toggles roll back and explain if saving fails [F-37]
- Corrupt settings are backed up and replaced with defaults instead of breaking the app [F-43]
- Character editor: Cancel, unsaved-changes prompt, one set of limits shared with import [F-40, F-41]

### Accessibility
- Message actions reachable by mouse hover and keyboard, not only long-press [F-06]
- History rows, settings rows and character cards are real buttons; no nested buttons [F-27, F-38]
- Dialogs and sheets keep focus inside and return it on close; destructive prompts focus Cancel [F-27]
- Back button on sub-pages; the tab bar highlights where you are [F-28, M-08]
- Toasts are announced to screen readers [F-45]
- Respects "reduce motion" [F-18]
- Every theme meets WCAG AA contrast for body text (checked by a unit test)

### Performance
- App bundle 4.33 MB → 0.50 MB by replacing the icon font with SVG icons [O-03]
- The previous model is freed before a new one loads, and before each reload [F-02, O-04]
- No backend polling during downloads [F-36]
- Streaming text renders once per frame; scrolling up while streaming stays put [F-07, O-06]
- History listing skips message bodies [O-07]

### Security
- Model ids are validated before touching the filesystem [F-39]
- Downloads are checked against the SHA-256 HuggingFace reports, when it reports one [M-02]

### Cleanup
- Removed unused plugins (http, shell), crates (uuid, anyhow, candle-nn), npm packages and permissions [C-01, C-02]
- Removed unused components, dev proxy config, husky / lint-staged and the stale plan [C-03, C-04]
- CI now runs lint, unit tests, `cargo test` and clippy [C-07]
- Release builds log at Info level [C-08]

### Upgrade notes
- No new environment variables; `VITE_API_BASE_URL` and `VITE_APP_NAME` were removed (unused).
- No data migration. Settings gain `theme` and `onboarding_done`; existing settings and chats load unchanged.
- `npm test` now runs once; use `npm run test:watch` to watch.

### Known limitations
- A reply still reloads the model weights from disk first (F-02).
- Downloads on Android continue only while the app stays open (F-32).
- Gemma 2 2B loading has not been re-tested (F-47).
