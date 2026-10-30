//! Text out of PDF and Word files in a connected folder.
//!
//! These formats are complex, and a damaged file can make a parser panic or
//! spin. Release builds abort on a panic, so a bad PDF would take the whole
//! app down. The work runs in a second copy of this program instead: if that
//! crashes or hangs, it is killed and the file is reported as unreadable.

use std::collections::HashMap;
use std::io::{Cursor, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{LazyLock, Mutex};
use std::thread;
use std::time::{Duration, Instant, SystemTime};

/// Starts this program as the extractor rather than the app.
pub const HELPER_FLAG: &str = "--neurix-read-document";
const MAX_FILE_BYTES: u64 = 40 * 1024 * 1024;
/// A zip entry can unpack to far more than the file's size on disk.
const MAX_XML_BYTES: u64 = 64 * 1024 * 1024;
const MAX_TEXT_CHARS: usize = 2_000_000;
/// How long one file may take before it is given up on.
const FILE_TIMEOUT: Duration = Duration::from_secs(15);

/// Whether a file is a format read through `extract`.
pub fn is_document(path: &Path) -> bool {
    matches!(extension(path).as_str(), "pdf" | "docx")
}

fn extension(path: &Path) -> String {
    path.extension().and_then(|e| e.to_str()).unwrap_or("").to_ascii_lowercase()
}

/// The text of a PDF or Word file. Runs in the helper process.
pub fn extract(path: &Path) -> Result<String, String> {
    let mut bytes = Vec::new();
    std::fs::File::open(path)
        .and_then(|f| f.take(MAX_FILE_BYTES + 1).read_to_end(&mut bytes))
        .map_err(|e| e.to_string())?;
    if bytes.len() as u64 > MAX_FILE_BYTES {
        return Err("too large".into());
    }
    let text = match extension(path).as_str() {
        "pdf" => pdf_text(&bytes)?,
        "docx" => docx_text(&bytes)?,
        other => return Err(format!("not a document: {other}")),
    };
    Ok(text.chars().take(MAX_TEXT_CHARS).collect())
}

/// Read page by page, so one bad page doesn't lose the rest.
fn pdf_text(bytes: &[u8]) -> Result<String, String> {
    let doc = lopdf::Document::load_mem(bytes).map_err(|e| e.to_string())?;
    if doc.is_encrypted() {
        return Err("password protected".into());
    }
    let pages: Vec<String> = doc
        .get_pages()
        .keys()
        .filter_map(|&page| doc.extract_text(&[page]).ok())
        .collect();
    Ok(pages.join("\n"))
}

fn docx_text(bytes: &[u8]) -> Result<String, String> {
    let mut archive = zip::ZipArchive::new(Cursor::new(bytes)).map_err(|e| e.to_string())?;
    let entry = archive.by_name("word/document.xml").map_err(|e| e.to_string())?;
    let mut xml = String::new();
    entry.take(MAX_XML_BYTES).read_to_string(&mut xml).map_err(|e| e.to_string())?;
    Ok(wordml_text(&xml))
}

/// The text runs of a Word body, with a line for each paragraph.
fn wordml_text(xml: &str) -> String {
    let mut out = String::new();
    let mut rest = xml;
    while let Some(start) = rest.find('<') {
        let Some(end) = rest[start..].find('>') else { break };
        let tag = &rest[start + 1..start + end];
        rest = &rest[start + end + 1..];
        let name = tag.split_whitespace().next().unwrap_or("").trim_end_matches('/');
        match name {
            "w:t" if !tag.ends_with('/') => {
                let Some(close) = rest.find("</w:t>") else { break };
                out.push_str(&unescape(&rest[..close]));
                rest = &rest[close + "</w:t>".len()..];
            }
            "w:tab" => out.push('\t'),
            "w:br" | "/w:p" | "/w:tr" => out.push('\n'),
            _ => {}
        }
    }
    out
}

fn unescape(text: &str) -> String {
    if !text.contains('&') {
        return text.to_string();
    }
    // &amp; last, so "&amp;lt;" comes out as the literal text "&lt;".
    text.replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&apos;", "'")
        .replace("&#39;", "'")
        .replace("&amp;", "&")
}

/// Entry point of the helper process: print the file's text and exit.
pub fn run_helper(path: &str) -> i32 {
    match extract(Path::new(path)) {
        Ok(text) => match std::io::stdout().write_all(text.as_bytes()) {
            Ok(()) => 0,
            Err(_) => 1,
        },
        Err(_) => 1,
    }
}

/// Run the helper on one file, killing it if it takes too long.
fn extract_isolated(path: &Path) -> Option<String> {
    let exe = std::env::current_exe().ok()?;
    let mut command = Command::new(exe);
    command.arg(HELPER_FLAG).arg(path).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    let mut child = command.spawn().ok()?;
    let mut stdout = child.stdout.take()?;
    // Drained on its own thread: a full pipe would block the helper forever.
    let reader = thread::spawn(move || {
        let mut text = String::new();
        stdout.read_to_string(&mut text).ok().map(|_| text)
    });

    let started = Instant::now();
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break Some(status),
            Ok(None) if started.elapsed() < FILE_TIMEOUT => thread::sleep(Duration::from_millis(20)),
            _ => {
                let _ = child.kill();
                let _ = child.wait();
                break None;
            }
        }
    };
    let text = reader.join().ok()??;
    (status?.success() && !text.trim().is_empty()).then_some(text)
}

type Stamp = (SystemTime, u64);

/// Extracted text by file, so a question doesn't re-read every PDF. An entry
/// of `None` remembers a file that can't be read.
static CACHE: LazyLock<Mutex<HashMap<PathBuf, (Stamp, Option<String>)>>> = LazyLock::new(Default::default);

pub enum Reading {
    Text(String),
    Unreadable,
    /// Not read yet: the search ran out of time for new files.
    NotReached,
}

/// A document's text, from the cache when the file hasn't changed. With
/// `may_extract` false, only what is already cached is returned.
pub fn read_cached(path: &Path, may_extract: bool) -> Reading {
    let Ok(meta) = std::fs::metadata(path) else { return Reading::Unreadable };
    let stamp = (meta.modified().unwrap_or(SystemTime::UNIX_EPOCH), meta.len());
    let reading = |text: Option<String>| text.map_or(Reading::Unreadable, Reading::Text);

    if let Ok(cache) = CACHE.lock() {
        if let Some((seen, text)) = cache.get(path) {
            if *seen == stamp {
                return reading(text.clone());
            }
        }
    }
    if !may_extract {
        return Reading::NotReached;
    }
    let text = extract_isolated(path);
    if let Ok(mut cache) = CACHE.lock() {
        cache.insert(path.to_path_buf(), (stamp, text.clone()));
    }
    reading(text)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A one-page PDF with correct offsets, built the way real ones are laid out.
    fn pdf(text: &str) -> Vec<u8> {
        let stream = format!("BT /F1 12 Tf 72 720 Td ({text}) Tj ET");
        let objects = [
            "<< /Type /Catalog /Pages 2 0 R >>".to_string(),
            "<< /Type /Pages /Kids [3 0 R] /Count 1 >>".to_string(),
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>".to_string(),
            format!("<< /Length {} >>\nstream\n{stream}\nendstream", stream.len()),
            "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>".to_string(),
        ];
        let mut out = String::from("%PDF-1.4\n");
        let mut offsets = Vec::new();
        for (i, body) in objects.iter().enumerate() {
            offsets.push(out.len());
            out.push_str(&format!("{} 0 obj\n{body}\nendobj\n", i + 1));
        }
        let xref = out.len();
        out.push_str(&format!("xref\n0 {}\n0000000000 65535 f \n", objects.len() + 1));
        for offset in offsets {
            out.push_str(&format!("{offset:010} 00000 n \n"));
        }
        out.push_str(&format!("trailer\n<< /Size {} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n", objects.len() + 1));
        out.into_bytes()
    }

    fn docx(body: &str) -> Vec<u8> {
        use zip::write::{SimpleFileOptions, ZipWriter};
        let mut writer = ZipWriter::new(Cursor::new(Vec::new()));
        writer.start_file("word/document.xml", SimpleFileOptions::default()).unwrap();
        writer.write_all(body.as_bytes()).unwrap();
        writer.finish().unwrap().into_inner()
    }

    #[test]
    fn reads_a_pdf() {
        let text = pdf_text(&pdf("The audit total is 777000")).unwrap();
        assert!(text.contains("777000"), "{text}");
    }

    #[test]
    fn a_broken_pdf_is_an_error() {
        assert!(pdf_text(b"%PDF-1.4 the audit total is 777000").is_err());
        assert!(pdf_text(&pdf("x")[..60]).is_err());
    }

    #[test]
    fn reads_a_word_file() {
        let xml = concat!(
            r#"<w:document><w:body><w:p><w:r><w:t>The contract </w:t></w:r><w:r><w:t xml:space="preserve">ends in April</w:t></w:r></w:p>"#,
            r#"<w:p><w:r><w:t>Tom &amp; Ana</w:t></w:r></w:p></w:body></w:document>"#,
        );
        assert_eq!(docx_text(&docx(xml)).unwrap(), "The contract ends in April\nTom & Ana\n");
    }

    #[test]
    fn a_broken_word_file_is_an_error() {
        assert!(docx_text(b"fake word file").is_err());
    }

    #[test]
    fn keeps_breaks_and_ignores_empty_runs() {
        assert_eq!(wordml_text("<w:t/><w:t>a</w:t><w:tab/><w:t>b</w:t><w:br/><w:t>c</w:t>"), "a\tb\nc");
    }

    #[test]
    fn only_pdf_and_word_are_documents() {
        assert!(is_document(Path::new("a/Report.PDF")));
        assert!(is_document(Path::new("letter.docx")));
        assert!(!is_document(Path::new("old.doc")));
        assert!(!is_document(Path::new("notes.txt")));
    }
}
