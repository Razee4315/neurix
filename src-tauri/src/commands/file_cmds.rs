//! Saving replies as files, and writing the files the assistant proposes
//! once the user approves them. Desktop only: a phone has no folder to hand
//! over, so these answer with an error there.

use crate::workspace;
#[cfg(desktop)]
use std::path::Path;
#[cfg(desktop)]
use tauri::{AppHandle, Manager};
#[cfg(desktop)]
use tauri_plugin_dialog::DialogExt;
#[cfg(desktop)]
use tauri_plugin_opener::OpenerExt;

const DESKTOP_ONLY: &str = "Saving files needs the desktop app.";

/// Ask where to save `content`. `None` when the user cancels.
#[cfg(desktop)]
#[tauri::command]
pub async fn save_file_as(app: AppHandle, name: String, content: String) -> Result<Option<String>, String> {
    if content.len() > workspace::MAX_FILE_BYTES {
        return Err("That file is too large to save.".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let mut dialog = app.dialog().file().set_title("Save as").set_file_name(&name);
        if let Some(window) = app.get_webview_window("main") {
            dialog = dialog.set_parent(&window);
        }
        let Some(picked) = dialog.blocking_save_file() else {
            return Ok(None);
        };
        let path = picked.into_path().map_err(|e| e.to_string())?;
        std::fs::write(&path, content).map_err(|e| e.to_string())?;
        Ok(Some(path.to_string_lossy().into_owned()))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(mobile)]
#[tauri::command]
pub async fn save_file_as(_name: String, _content: String) -> Result<Option<String>, String> {
    Err(DESKTOP_ONLY.into())
}

/// Whether `name` already exists in `folder`, and an error if the name is
/// one Neurix won't write, so the card can say so before anyone approves.
#[tauri::command]
pub async fn check_workspace_file(folder: String, name: String) -> Result<bool, String> {
    Ok(workspace::target(&folder, &name)?.exists())
}

/// Write an approved file into the chosen folder and return its full path.
#[tauri::command]
pub async fn write_workspace_file(
    folder: String,
    name: String,
    content: String,
    overwrite: bool,
) -> Result<String, String> {
    if cfg!(mobile) {
        return Err(DESKTOP_ONLY.into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        workspace::write(&folder, &name, &content, overwrite).map(|p| p.to_string_lossy().into_owned())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Open a written file in the app the system uses for that kind of file.
#[cfg(desktop)]
#[tauri::command]
pub async fn open_workspace_file(app: AppHandle, path: String) -> Result<(), String> {
    if !workspace::can_open(Path::new(&path)) {
        return Err("Neurix doesn't open that kind of file.".into());
    }
    app.opener().open_path(path, None::<&str>).map_err(|e| e.to_string())
}

#[cfg(mobile)]
#[tauri::command]
pub async fn open_workspace_file(_path: String) -> Result<(), String> {
    Err(DESKTOP_ONLY.into())
}
