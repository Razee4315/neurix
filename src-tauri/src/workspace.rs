//! Rules for files the assistant writes into the folder the user chose.
//!
//! The name comes from the model, so it is treated like any other untrusted
//! input: it has to stay inside the folder and be a kind of file that does
//! nothing by itself. Writing only ever happens after the user approves it.

use std::fs;
use std::path::{Component, Path, PathBuf};

/// Plain text and web files. Scripts Windows would run on a double click
/// (.bat, .cmd, .ps1, .vbs) and programs are left out on purpose.
const WRITABLE: &[&str] = &[
    "html", "htm", "css", "js", "mjs", "jsx", "ts", "tsx", "json", "md", "markdown", "txt", "csv",
    "tsv", "xml", "svg", "yaml", "yml", "toml", "ini", "log", "py", "rs", "go", "java", "kt",
    "swift", "c", "h", "cpp", "sql",
];
/// What may be opened in another app afterwards. A .js file is writable but
/// not here: Windows runs those through Script Host rather than showing them.
const OPENABLE: &[&str] = &["html", "htm", "md", "markdown", "txt", "csv", "json", "svg"];
/// Names Windows reserves for devices, with any extension.
const RESERVED: &[&str] = &[
    "con", "prn", "aux", "nul", "com1", "com2", "com3", "com4", "com5", "com6", "com7", "com8",
    "com9", "lpt1", "lpt2", "lpt3", "lpt4", "lpt5", "lpt6", "lpt7", "lpt8", "lpt9",
];
const MAX_NAME_CHARS: usize = 120;
const MAX_DEPTH: usize = 4;
/// Far more than a small model can write in one reply.
pub const MAX_FILE_BYTES: usize = 2 * 1024 * 1024;

fn extension(path: &Path) -> String {
    path.extension().and_then(|e| e.to_str()).unwrap_or("").to_ascii_lowercase()
}

/// Check a model-chosen name and turn it into a path inside the folder.
pub fn safe_relative(name: &str) -> Result<PathBuf, String> {
    let name = name.trim();
    if name.is_empty() || name.chars().count() > MAX_NAME_CHARS {
        return Err("That file name isn't usable.".into());
    }
    if name.chars().any(|c| c.is_control() || "<>:\"|?*".contains(c)) {
        return Err(format!("{name} has characters a file name can't use."));
    }
    let path = PathBuf::from(name.replace('\\', "/"));
    let mut depth = 0;
    for part in path.components() {
        let Component::Normal(part) = part else {
            return Err(format!("{name} points outside the folder."));
        };
        depth += 1;
        let part = part.to_string_lossy();
        let stem = part.split('.').next().unwrap_or("").to_ascii_lowercase();
        if part.starts_with('.') || part.ends_with('.') || part.ends_with(' ') || RESERVED.contains(&stem.as_str()) {
            return Err(format!("{name} isn't a name Neurix can create."));
        }
    }
    if depth == 0 || depth > MAX_DEPTH {
        return Err(format!("{name} isn't a name Neurix can create."));
    }
    if !WRITABLE.contains(&extension(&path).as_str()) {
        return Err(format!("Neurix doesn't create {} files.", path.extension().map_or("those".into(), |e| e.to_string_lossy())));
    }
    Ok(path)
}

/// Whether a file may be handed to the system to open.
pub fn can_open(path: &Path) -> bool {
    OPENABLE.contains(&extension(path).as_str())
}

/// The full path of `name` in `folder`, confirming the folder is still there.
pub fn target(folder: &str, name: &str) -> Result<PathBuf, String> {
    let root = Path::new(folder);
    if !root.is_dir() {
        return Err(format!("The folder {folder} is no longer there."));
    }
    Ok(root.join(safe_relative(name)?))
}

/// Write a file, making any subfolders. A link inside the folder can't be
/// used to reach outside it: the real parent is checked before writing.
pub fn write(folder: &str, name: &str, content: &str, overwrite: bool) -> Result<PathBuf, String> {
    if content.len() > MAX_FILE_BYTES {
        return Err("That file is too large to write.".into());
    }
    let path = target(folder, name)?;
    if path.exists() && !overwrite {
        return Err(format!("{name} already exists."));
    }
    let parent = path.parent().ok_or("That file name isn't usable.")?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    let real_root = fs::canonicalize(folder).map_err(|e| e.to_string())?;
    let real_parent = fs::canonicalize(parent).map_err(|e| e.to_string())?;
    if !real_parent.starts_with(&real_root) {
        return Err(format!("{name} points outside the folder."));
    }
    if fs::symlink_metadata(&path).is_ok_and(|m| m.file_type().is_symlink()) {
        return Err(format!("{name} is a link, so Neurix won't write through it."));
    }
    fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(path)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("neurix-workspace-{name}"));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn accepts_ordinary_names() {
        assert_eq!(safe_relative("index.html").unwrap(), PathBuf::from("index.html"));
        assert_eq!(safe_relative(" css/site.css ").unwrap(), PathBuf::from("css/site.css"));
        assert_eq!(safe_relative("notes\\plan.md").unwrap(), PathBuf::from("notes/plan.md"));
    }

    #[test]
    fn refuses_to_leave_the_folder() {
        for name in ["../evil.txt", "a/../../evil.txt", "/etc/evil.txt", "C:\\evil.txt", "C:/evil.txt", "\\\\server\\evil.txt"] {
            assert!(safe_relative(name).is_err(), "{name}");
        }
    }

    #[test]
    fn refuses_files_that_run_or_hide() {
        for name in ["run.bat", "run.cmd", "run.ps1", "run.exe", "run.vbs", "setup", ".env", ".git/config", "index.html.exe"] {
            assert!(safe_relative(name).is_err(), "{name}");
        }
    }

    #[test]
    fn refuses_windows_trick_names() {
        for name in ["con.txt", "NUL.html", "lpt1.md", "page.html ", "file.txt.", "index.html:stream", "a/b/c/d/e/f.txt"] {
            let trimmed_ok = name == "page.html ";
            assert_eq!(safe_relative(name).is_ok(), trimmed_ok, "{name}");
        }
    }

    #[test]
    fn writes_new_files_and_subfolders() {
        let dir = temp("write");
        let folder = dir.to_string_lossy();
        let path = write(&folder, "site/index.html", "<h1>Hi</h1>", false).unwrap();
        assert_eq!(fs::read_to_string(path).unwrap(), "<h1>Hi</h1>");
    }

    #[test]
    fn keeps_an_existing_file_unless_told_to_replace_it() {
        let dir = temp("exists");
        let folder = dir.to_string_lossy();
        write(&folder, "a.txt", "first", false).unwrap();
        assert!(write(&folder, "a.txt", "second", false).unwrap_err().contains("already exists"));
        assert_eq!(fs::read_to_string(dir.join("a.txt")).unwrap(), "first");
        write(&folder, "a.txt", "second", true).unwrap();
        assert_eq!(fs::read_to_string(dir.join("a.txt")).unwrap(), "second");
    }

    #[test]
    fn a_missing_folder_is_an_error_not_a_new_folder() {
        let dir = temp("gone");
        let gone = dir.join("nope");
        assert!(write(&gone.to_string_lossy(), "a.txt", "x", false).is_err());
        assert!(!gone.exists());
    }

    #[test]
    fn only_harmless_files_can_be_opened() {
        assert!(can_open(Path::new("index.html")));
        assert!(!can_open(Path::new("app.js")));
        assert!(!can_open(Path::new("tool.py")));
    }
}
