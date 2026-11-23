# UX Baseline (`v1.0.1` / `v1.0.0` Native)

Measured click counts, screen transitions, task timings, and concrete friction points across the 5 primary user workflows. Playwright timings recorded in mock IPC mode (`task-362`, Vite dev server); native cold-load timings recorded against `C:\Program Files\Neurix\neurix-tauri.exe` (`task-160`).

---

## Summary Table

| # | User Task | Clicks | Screens Visited | Measured Time | Friction Severity |
|---|---|---:|---|---:|---|
| 1 | First-run onboarding -> download -> chat | 2 | `/`, `/onboarding`, `/downloading`, `/chat` | `3,042.4 ms` to start (`14,503.7 ms` mock total; **`73,785 ms`** native warm load) | **High** (73.8s boot block when model installed) |
| 2 | Switch character/friend & send prompt | 4 | `/chat` | `4,503.9 ms` (incl. simulated stream) | **Medium** (mobile overlap + starter scroll) |
| 3 | Connect a local folder or GitHub repo | 4 | `/connectors`, `/chat` | `742.8 ms` modal submit | **High** (orphan card + fake "Soon" cards + O(n) scan) |
| 4 | Find an old chat and reopen it | 3 | `/chat/history`, `/chat` | `520.0 ms` search filter | **Low–Medium** (no folders/tags/pinning/jump-to-match) |
| 5 | Change theme & text size in Settings | 4 | `/chat`, `/settings` | `3,544.3 ms` nav + toggle | **Medium** (unlabeled `Aa` buttons + no System auto) |

---

## Detailed Task Breakdowns

### Task 1: First-Run Onboarding -> Download Model -> Reach Chat
- **Flow**:
  1. Launch app (`/` SplashScreen) -> click **Get started** (Click 1).
  2. Review hardware recommendation on `/onboarding` -> click **Download · 1.3 GB** (Click 2).
  3. Watch progress on `/downloading` -> auto-loads model (`downloadHandoff.ts`) and navigates to `/chat`.
- **Measured Baseline**:
  - `2` clicks, `4` screens, `3,042.4 ms` to initiate download, `14,503.7 ms` total in mock flow (`desktop-splash.png`, `desktop-onboarding.png`, `desktop-downloading.png`, `desktop-chat-welcome.png`).
  - **Subsequent Launches (Real Native `v1.0.0`)**: **`73,785 ms` (~73.8 seconds)** trapped on `BootScreen` waiting for `qwen-3.5-4b-3d-coder` (`2.71 GB`) to load into CPU RAM before `/chat` becomes accessible.
- **Concrete Friction Points**:
  1. Returning users cannot read history, open Settings, or delete/switch models for >1 minute while the previous model synchronously loads on startup.
  2. Users picking `Choose a different model` on `/onboarding` land on `/store`, then `/store/model`, where the `Download` CTA is hidden below the desktop fold!

### Task 2: Switch Persona (Character/Friend) & Send Prompt with Reasoning
- **Flow**:
  1. On `/chat`, click persona dropdown (`Default v` in header) (Click 1).
  2. Select `Tutor` (Click 2).
  3. Toggle **Think** pill inside composer (Click 3).
  4. Type message -> press **Enter** / click Send (Click 4).
- **Measured Baseline**:
  - `4` clicks, `1` screen (`/chat`), `4,503.9 ms` including mock token stream (`desktop-chat-active.png`).
- **Concrete Friction Points**:
  1. Enabling **Think** appends `"Reasons first: can take a minute or two"` inside the composer row, which truncates (`"Reasons first: ca"`) and physically overlaps the ContextIndicator ring at `390px` mobile width (`mobile-chat.png`).
  2. Long replies scroll past the user's message bubble; `Coachmark` overlaps the top of the first reply banner.
  3. No quick `/command` or keyboard switcher to change personas without using the mouse dropdown.
  4. No visible `+` file/image attach button in the main composer toolbar; no Edit-and-Branch or Fork button to explore alternate replies.

### Task 3: Connect a Knowledge Source (GitHub Repo or Local Folder) for Chat
- **Flow**:
  1. Click **Connectors** in left sidebar (Click 1).
  2. Click **Connect** on GitHub card (Click 2).
  3. Enter `owner/repository` (e.g., `Razee4315/neurix`) -> click **Connect repository** (Click 3).
  4. Click **New chat** or **Chats** to return and prompt with context (Click 4).
- **Measured Baseline**:
  - `4` clicks, `2` screens (`/connectors`, `/chat`), `742.8 ms` in modal interaction (`desktop-connectors.png`).
- **Concrete Friction Points**:
  1. After connecting, user stays on `/connectors` with only a transient toast and no one-click `"Chat with this repo/folder"` CTA.
  2. 4 non-functional `"Coming soon"` cards (`Google Drive`, `Outlook`, `Slack`, `Notion`) + 1 dashed `"Add a custom connector"` MCP stub dominate screen real estate while remaining dead clicks.
  3. In `/chat`, active folder search re-scans files linearly on disk (`folder_search.rs`) with no persistent SQLite FTS5 index, index status badge, or retrieved chunk citation preview.

### Task 4: Find an Existing Chat in History & Reopen It
- **Flow**:
  1. Click **Search chats** in sidebar (`Ctrl+Shift+F`) (Click 1).
  2. Type search query (`yaml`) -> matching snippet updates immediately (`520.0 ms`).
  3. Click matching conversation card -> opens `/chat` with that thread active (Click 2–3).
- **Measured Baseline**:
  - `3` clicks (or `Ctrl+Shift+F` + click), `2` screens (`/chat/history`, `/chat`), `520.0 ms` (`desktop-history.png`).
- **Concrete Friction Points**:
  1. Opens at bottom of thread rather than scrolling/highlighting the matched snippet inside long chats.
  2. No folders/workspaces, pinned conversations, multi-select cleanup, or bulk export.

### Task 5: Customize Appearance (Theme & Text Size) in Settings
- **Flow**:
  1. Click bottom-left `On this device` footer button (Click 1).
  2. Click **Settings** in flyout menu (`Ctrl+,`) (Click 2).
  3. Click **Paper** theme swatch (`456.5 ms` transition) (Click 3).
  4. Click **Large text** segment (`Aa`) -> return to chat (Click 4).
- **Measured Baseline**:
  - `4` clicks, `2` screens (`/chat`, `/settings`), `3,544.3 ms` (`desktop-settings.png`, `desktop-chat-paper.png`).
- **Concrete Friction Points**:
  1. Reaching Settings via mouse takes 2 clicks inside an easily missed footer flyout (and looks nearly identical to Claude Desktop's account popover).
  2. All 4 text-size buttons look identical (`Aa`) with no text labels (`Small`, `Default`, `Large`, `XL`), forcing trial-and-error.
  3. Missing **System** (`auto` light/dark) mode, **Engine / Hardware** settings (GPU layers, Context length, KV cache quant, Flash Attention), and **Accent / Compact density** options.
