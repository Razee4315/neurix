//! The local folders connector: the user picks a folder in a native dialog,
//! and its text files are read on this device to give the model context.
//! Nothing here touches the network.

use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;

/// Extensions read as plain text. Anything else is listed but not read.
const TEXT_EXTENSIONS: &[&str] = &[
    "txt", "md", "markdown", "csv", "tsv", "json", "yaml", "yml", "toml", "xml", "html", "css",
    "log", "ini", "rs", "ts", "tsx", "js", "jsx", "py", "java", "kt", "swift", "go", "c", "h",
    "cpp", "sql", "sh",
];
/// Folders that are never worth reading.
const SKIP_DIRS: &[&str] = &["node_modules", "target", "dist", "build", ".git", "__pycache__", "venv"];
const MAX_DEPTH: usize = 3;
const MAX_FILES: usize = 400;
/// Per file, so one long file can't crowd out the rest.
const MAX_FILE_CHARS: usize = 4_000;

#[derive(Serialize)]
pub struct FolderFile {
    /// Path relative to the connected folder.
    pub path: String,
    pub size_bytes: u64,
    /// Text read for the model, or `None` when it didn't fit or isn't text.
    pub content: Option<String>,
    pub truncated: bool,
}

#[derive(Serialize)]
pub struct FolderSnapshot {
    pub name: String,
    pub path: String,
    pub total_files: usize,
    pub text_files: usize,
    pub files: Vec<FolderFile>,
}

/// Show the native folder picker. `None` when the user cancels.
#[tauri::command]
pub async fn pick_folder(app: AppHandle) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut dialog = app.dialog().file().set_title("Connect a folder");
        #[cfg(desktop)]
        {
            if let Some(window) = app.get_webview_window("main") {
                dialog = dialog.set_parent(&window);
            }
        }
        match dialog.blocking_pick_folder() {
            Some(picked) => picked
                .into_path()
                .map(|p| Some(p.to_string_lossy().into_owned()))
                .map_err(|e| e.to_string()),
            None => Ok(None),
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

fn is_text(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| TEXT_EXTENSIONS.contains(&e.to_ascii_lowercase().as_str()))
        .unwrap_or(false)
}

fn walk(dir: &Path, depth: usize, out: &mut Vec<PathBuf>) {
    let Ok(entries) = fs::read_dir(dir) else { return };
    let mut entries: Vec<_> = entries.flatten().collect();
    entries.sort_by_key(|e| e.file_name());
    for entry in entries {
        if out.len() >= MAX_FILES {
            return;
        }
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if name.starts_with('.') {
            continue;
        }
        let path = entry.path();
        match entry.file_type() {
            Ok(t) if t.is_dir() => {
                if depth < MAX_DEPTH && !SKIP_DIRS.contains(&name.as_ref()) {
                    walk(&path, depth + 1, out);
                }
            }
            Ok(t) if t.is_file() => out.push(path),
            _ => {}
        }
    }
}

/// List a connected folder and read its text files, up to `max_chars` in total.
#[tauri::command]
pub async fn read_folder(path: String, max_chars: usize) -> Result<FolderSnapshot, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let root = PathBuf::from(&path);
        if !root.is_dir() {
            return Err(format!("The folder {path} is no longer there."));
        }
        let mut paths = Vec::new();
        walk(&root, 0, &mut paths);

        let mut budget = max_chars;
        let mut text_files = 0;
        let files = paths
            .iter()
            .map(|p| {
                let size_bytes = fs::metadata(p).map(|m| m.len()).unwrap_or(0);
                let rel = p.strip_prefix(&root).unwrap_or(p).to_string_lossy().into_owned();
                let mut content = None;
                let mut truncated = false;
                if is_text(p) {
                    text_files += 1;
                    if budget > 0 {
                        if let Ok(text) = fs::read_to_string(p) {
                            let limit = MAX_FILE_CHARS.min(budget);
                            let taken: String = text.chars().take(limit).collect();
                            truncated = taken.len() < text.len();
                            budget = budget.saturating_sub(taken.chars().count());
                            content = Some(taken);
                        }
                    }
                }
                FolderFile { path: rel, size_bytes, content, truncated }
            })
            .collect();

        Ok(FolderSnapshot {
            name: root
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_else(|| path.clone()),
            path,
            total_files: paths.len(),
            text_files,
            files,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

// ── Gmail ──────────────────────────────────────────────────────────────
//
// Read over IMAP with an app password (Google offers one once 2-Step
// Verification is on). The mailbox is opened read-only (EXAMINE) and
// messages are fetched with BODY.PEEK, so nothing is marked as read.

#[derive(Serialize)]
pub struct MailSummary {
    pub from: String,
    pub subject: String,
    pub date: String,
    /// Start of the plain-text body.
    pub snippet: String,
}

#[cfg(desktop)]
const SNIPPET_CHARS: usize = 600;

#[cfg(desktop)]
fn plain_text(mail: &mailparse::ParsedMail) -> Option<String> {
    if mail.subparts.is_empty() {
        if mail.ctype.mimetype.starts_with("text/plain") {
            return mail.get_body().ok();
        }
        if mail.ctype.mimetype.starts_with("text/html") {
            // Crude tag strip: enough for a snippet.
            let html = mail.get_body().ok()?;
            let re = regex_lite_strip(&html);
            return Some(re);
        }
        return None;
    }
    mail.subparts
        .iter()
        .find_map(|p| if p.ctype.mimetype == "text/plain" { p.get_body().ok() } else { None })
        .or_else(|| mail.subparts.iter().find_map(plain_text))
}

#[cfg(desktop)]
fn regex_lite_strip(html: &str) -> String {
    let mut out = String::with_capacity(html.len());
    let mut in_tag = false;
    for c in html.chars() {
        match c {
            '<' => in_tag = true,
            '>' => {
                in_tag = false;
                out.push(' ');
            }
            _ if !in_tag => out.push(c),
            _ => {}
        }
    }
    out
}

#[cfg(desktop)]
fn squash(text: &str, limit: usize) -> String {
    text.split_whitespace().collect::<Vec<_>>().join(" ").chars().take(limit).collect()
}

/// The newest `limit` emails in the inbox, newest first.
#[cfg(desktop)]
#[tauri::command]
pub async fn gmail_fetch(email: String, app_password: String, limit: u32) -> Result<Vec<MailSummary>, String> {
    tauri::async_runtime::spawn_blocking(move || -> Result<Vec<MailSummary>, String> {
        let tls = native_tls::TlsConnector::new().map_err(|e| e.to_string())?;
        let client = imap::connect(("imap.gmail.com", 993), "imap.gmail.com", &tls)
            .map_err(|e| format!("Couldn't reach Gmail: {e}"))?;
        let password: String = app_password.chars().filter(|c| !c.is_whitespace()).collect();
        let mut session = client.login(&email, &password).map_err(|_| {
            "Gmail refused the sign-in. Check the address and use an app password, not your Google password.".to_string()
        })?;
        let mailbox = session.examine("INBOX").map_err(|e| e.to_string())?;
        let total = mailbox.exists;
        if total == 0 {
            let _ = session.logout();
            return Ok(Vec::new());
        }
        let first = total.saturating_sub(limit.max(1) - 1).max(1);
        let fetched = session
            .fetch(format!("{first}:{total}"), "BODY.PEEK[]")
            .map_err(|e| e.to_string())?;
        let mut mails: Vec<MailSummary> = fetched
            .iter()
            .filter_map(|m| {
                let raw = m.body()?;
                let parsed = mailparse::parse_mail(raw).ok()?;
                let header = |name: &str| {
                    parsed
                        .headers
                        .iter()
                        .find(|h| h.get_key_ref().eq_ignore_ascii_case(name))
                        .map(|h| h.get_value())
                        .unwrap_or_default()
                };
                Some(MailSummary {
                    from: header("From"),
                    subject: header("Subject"),
                    date: header("Date"),
                    snippet: squash(&plain_text(&parsed).unwrap_or_default(), SNIPPET_CHARS),
                })
            })
            .collect();
        mails.reverse();
        let _ = session.logout();
        Ok(mails)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(mobile)]
#[tauri::command]
pub async fn gmail_fetch(_email: String, _app_password: String, _limit: u32) -> Result<Vec<MailSummary>, String> {
    Err("Gmail is available in the desktop app.".into())
}

// ── GitHub ─────────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct GithubIssue {
    pub number: u64,
    pub title: String,
    pub kind: String,
}

#[derive(Serialize)]
pub struct GithubSnapshot {
    pub repo: String,
    pub description: String,
    pub stars: u64,
    pub language: String,
    pub readme: String,
    pub open_items: Vec<GithubIssue>,
}

const README_CHARS: usize = 3_000;

/// Public data of a GitHub repository: description, README and open issues.
#[tauri::command]
pub async fn github_fetch(repo: String) -> Result<GithubSnapshot, String> {
    let repo = repo
        .trim()
        .trim_start_matches("https://github.com/")
        .trim_end_matches('/')
        .trim_end_matches(".git")
        .to_string();
    if repo.split('/').count() != 2 {
        return Err("Use the form owner/repository, for example Razee4315/neurix.".into());
    }
    let client = reqwest::Client::builder()
        .user_agent("Neurix")
        .build()
        .map_err(|e| e.to_string())?;
    let get = |path: String| {
        let client = client.clone();
        async move {
            let res = client
                .get(format!("https://api.github.com/repos/{path}"))
                .header("Accept", "application/vnd.github+json")
                .send()
                .await
                .map_err(|e| format!("Couldn't reach GitHub: {e}"))?;
            if res.status().as_u16() == 404 {
                return Err("GitHub has no public repository by that name.".to_string());
            }
            if !res.status().is_success() {
                return Err(format!("GitHub answered {}", res.status()));
            }
            let body = res.text().await.map_err(|e| e.to_string())?;
            serde_json::from_str::<serde_json::Value>(&body).map_err(|e| e.to_string())
        }
    };

    let info = get(repo.clone()).await?;
    let readme = match get(format!("{repo}/readme")).await {
        Ok(v) => {
            let b64: String = v["content"].as_str().unwrap_or("").chars().filter(|c| !c.is_whitespace()).collect();
            use base64::Engine;
            base64::engine::general_purpose::STANDARD
                .decode(b64)
                .ok()
                .and_then(|bytes| String::from_utf8(bytes).ok())
                .map(|t| t.chars().take(README_CHARS).collect())
                .unwrap_or_default()
        }
        Err(_) => String::new(),
    };
    let open_items = get(format!("{repo}/issues?state=open&per_page=15"))
        .await
        .ok()
        .and_then(|v| v.as_array().cloned())
        .unwrap_or_default()
        .iter()
        .map(|i| GithubIssue {
            number: i["number"].as_u64().unwrap_or(0),
            title: i["title"].as_str().unwrap_or("").to_string(),
            kind: if i.get("pull_request").is_some() { "pull request" } else { "issue" }.to_string(),
        })
        .collect();

    Ok(GithubSnapshot {
        repo: info["full_name"].as_str().unwrap_or(&repo).to_string(),
        description: info["description"].as_str().unwrap_or("").to_string(),
        stars: info["stargazers_count"].as_u64().unwrap_or(0),
        language: info["language"].as_str().unwrap_or("").to_string(),
        readme,
        open_items,
    })
}
