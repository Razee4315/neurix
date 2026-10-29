//! The local folders connector: the user picks a folder in a native dialog,
//! and its text files are read on this device to give the model context.
//! Nothing here touches the network.

use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
#[cfg(desktop)]
use tauri::{AppHandle, Manager};
#[cfg(desktop)]
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
#[cfg(desktop)]
#[tauri::command]
pub async fn pick_folder(app: AppHandle) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut dialog = app.dialog().file().set_title("Connect a folder");
        if let Some(window) = app.get_webview_window("main") {
            dialog = dialog.set_parent(&window);
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

/// Phones can't hand an app a folder to read later (the picker returns a
/// content URI, not a path), so phones share single documents instead.
#[cfg(mobile)]
#[tauri::command]
pub async fn pick_folder() -> Result<Option<String>, String> {
    Err("Connecting a folder needs the desktop app. On a phone, add documents instead.".into())
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
// Desktop uses the `imap` crate over the platform TLS; phones use the small
// rustls client in `imap_lite`.

#[derive(Serialize)]
pub struct MailSummary {
    pub from: String,
    pub subject: String,
    pub date: String,
    /// Start of the plain-text body.
    pub snippet: String,
}

const SNIPPET_CHARS: usize = 600;

fn plain_text(mail: &mailparse::ParsedMail) -> Option<String> {
    if mail.subparts.is_empty() {
        if mail.ctype.mimetype.starts_with("text/plain") {
            return mail.get_body().ok();
        }
        if mail.ctype.mimetype.starts_with("text/html") {
            // Crude tag strip: enough for a snippet.
            let html = mail.get_body().ok()?;
            return Some(strip_tags(&html));
        }
        return None;
    }
    mail.subparts
        .iter()
        .find_map(|p| if p.ctype.mimetype == "text/plain" { p.get_body().ok() } else { None })
        .or_else(|| mail.subparts.iter().find_map(plain_text))
}

fn strip_tags(html: &str) -> String {
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

fn squash(text: &str, limit: usize) -> String {
    text.split_whitespace().collect::<Vec<_>>().join(" ").chars().take(limit).collect()
}

/// Sender, subject, date and the start of the text of one raw message.
fn summarize(raw: &[u8]) -> Option<MailSummary> {
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
        let mut mails: Vec<MailSummary> = fetched.iter().filter_map(|m| summarize(m.body()?)).collect();
        mails.reverse();
        let _ = session.logout();
        Ok(mails)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// The newest `limit` emails in the inbox, newest first.
#[cfg(mobile)]
#[tauri::command]
pub async fn gmail_fetch(email: String, app_password: String, limit: u32) -> Result<Vec<MailSummary>, String> {
    tauri::async_runtime::spawn_blocking(move || -> Result<Vec<MailSummary>, String> {
        let password: String = app_password.chars().filter(|c| !c.is_whitespace()).collect();
        let raw = crate::imap_lite::fetch_gmail(email.trim(), &password, limit)?;
        Ok(raw.iter().filter_map(|m| summarize(m)).collect())
    })
    .await
    .map_err(|e| e.to_string())?
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn summarize_reads_headers_and_plain_text() {
        let raw = concat!(
            "From: Ana <ana@example.com>\r\n",
            "Subject: Rota\r\n",
            "Date: Mon, 1 Jun 2026 09:00:00 +0000\r\n",
            "Content-Type: multipart/alternative; boundary=\"b\"\r\n",
            "\r\n",
            "--b\r\n",
            "Content-Type: text/html\r\n",
            "\r\n",
            "<p>Ignored</p>\r\n",
            "--b\r\n",
            "Content-Type: text/plain\r\n",
            "\r\n",
            "Nights:   Tom\r\n",
            " and Ana.\r\n",
            "--b--\r\n",
        );
        let mail = summarize(raw.as_bytes()).expect("parses");
        assert_eq!(mail.from, "Ana <ana@example.com>");
        assert_eq!(mail.subject, "Rota");
        assert_eq!(mail.snippet, "Nights: Tom and Ana.");
    }

    #[test]
    fn summarize_survives_a_message_cut_short() {
        // Phones fetch only the start of each message.
        let raw = concat!(
            "From: Bo <bo@example.com>\r\n",
            "Subject: Long\r\n",
            "Content-Type: multipart/mixed; boundary=\"x\"\r\n",
            "\r\n",
            "--x\r\n",
            "Content-Type: text/plain\r\n",
            "\r\n",
            "The start of it",
        );
        let mail = summarize(raw.as_bytes()).expect("parses");
        assert_eq!(mail.from, "Bo <bo@example.com>");
        assert_eq!(mail.subject, "Long");
    }

    use crate::inference::engine::{load_model_from_disk, GenerationRequest, LoadOptions};
    use crate::models::catalog::SamplingDefaults;
    use crate::inference::engine::InferenceEvent;
    use tokio_util::sync::CancellationToken;

    /// The folder connector against a real model: the demo folder is read,
    /// the relevant file goes in front of the question, and the answer must
    /// come from it. Needs `NEURIX_TEST_MODEL` and `NEURIX_TEST_FOLDER`.
    #[test]
    #[ignore = "needs a model file and a folder"]
    fn real_model_answers_from_folder() {
        let model_path = std::env::var("NEURIX_TEST_MODEL").expect("NEURIX_TEST_MODEL");
        let folder = std::env::var("NEURIX_TEST_FOLDER").expect("NEURIX_TEST_FOLDER");
        let snap = tauri::async_runtime::block_on(read_folder(folder, 120_000)).expect("read_folder");
        println!("folder {}: {} files, {} text", snap.name, snap.total_files, snap.text_files);
        assert!(snap.text_files > 0, "no readable files");

        // Same shape as connectorContext + withContext in the frontend.
        let bodies: String = snap
            .files
            .iter()
            .filter_map(|f| f.content.as_ref().map(|c| format!("--- File: {} ---\n{c}\n\n", f.path)))
            .collect();
        let sources = format!("Local folder \"{}\".\n\n{bodies}", snap.name);
        let sampling = SamplingDefaults { top_k: 40, min_p: 0.05, repeat_penalty: 1.0 };
        let mut model = load_model_from_disk(
            "test",
            Path::new(&model_path),
            sampling,
            LoadOptions { context_length: 4096, threads: 4 },
        )
        .expect("load");

        for (question, expect) in [
            ("How many staff must sign for a controlled drug?", "two"),
            ("Who works the night shift on Wednesday?", "tom"),
        ] {
            let prompt = format!(
                "Use the following material from my connected sources to answer. It was read on this device.\n\
                 Answer from it when it is relevant and say which file, email or repository you used.\n\
                 If the answer is not in it, say so and then answer from general knowledge.\n\n\
                 <sources>\n{sources}</sources>\n\nMy question: {question}"
            );
            let request = GenerationRequest {
                system_prompt: "You are a helpful assistant. Give clear, concise answers. Do not repeat yourself.".into(),
                history: Vec::new(),
                user_message: prompt,
                assistant_prefix: None,
                max_tokens: 160,
                temperature: 0.0,
                top_p: 1.0,
                enable_thinking: false,
            };
            let mut answer = String::new();
            model
                .generate(
                    &request,
                    &mut |e: InferenceEvent| {
                        if let InferenceEvent::TokenGenerated { token, .. } = e {
                            answer.push_str(&token)
                        }
                    },
                    &CancellationToken::new(),
                )
                .expect("generate");
            println!("Q: {question}\nA: {answer}\n");
            let a = answer.to_lowercase();
            assert!(a.contains(expect) || (expect == "two" && a.contains('2')), "answer missed: {answer}");
        }
    }
}
