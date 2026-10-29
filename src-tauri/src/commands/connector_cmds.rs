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
