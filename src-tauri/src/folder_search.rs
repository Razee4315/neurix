//! Finding the parts of a connected folder that bear on a question.
//!
//! A small model reads about 50 tokens a second, so every character sent to
//! it is a wait for the user. The whole folder is searched here and only the
//! few passages that match are handed over. Nothing here touches the disk.

use serde::Serialize;

/// Size of the passages a file is cut into.
const CHUNK_CHARS: usize = 800;
/// Passages sent per question: enough to answer, few enough to read quickly.
const MAX_EXCERPTS: usize = 3;
/// Passages scoring below this share of the best one are noise.
const KEEP_RATIO: f64 = 0.4;

/// Words that say nothing about what to look for. Words about the folder
/// itself are here too: "list my files" is not a search for the word "file".
const STOP_WORDS: &[&str] = &[
    "the", "and", "for", "with", "that", "this", "what", "who", "how", "why", "when", "where",
    "which", "from", "have", "has", "had", "are", "was", "were", "you", "your", "about", "into",
    "does", "did", "can", "could", "would", "should", "will", "there", "their", "them", "they",
    "his", "her", "its", "our", "out", "not", "all", "any", "tell", "give", "show", "find", "list",
    "please", "file", "files", "folder", "folders", "document", "documents", "connected", "name",
    "names", "according",
];

pub struct Doc {
    /// Path relative to the connected folder.
    pub path: String,
    pub text: String,
}

#[derive(Serialize, Debug, PartialEq)]
pub struct Excerpt {
    pub path: String,
    pub text: String,
}

/// Decode a text file. Windows tools still save UTF-16 and ANSI, so anything
/// that isn't UTF-8 is tried as those. `None` means it isn't text at all.
pub fn decode_text(bytes: &[u8]) -> Option<String> {
    if let Some(rest) = bytes.strip_prefix(&[0xFF, 0xFE]) {
        return Some(decode_utf16(rest, u16::from_le_bytes));
    }
    if let Some(rest) = bytes.strip_prefix(&[0xFE, 0xFF]) {
        return Some(decode_utf16(rest, u16::from_be_bytes));
    }
    let bytes = bytes.strip_prefix(&[0xEF, 0xBB, 0xBF]).unwrap_or(bytes);
    if bytes.contains(&0) {
        return None;
    }
    match std::str::from_utf8(bytes) {
        Ok(text) => Some(text.to_string()),
        // Only the end is broken: the read stopped inside a character.
        Err(e) if e.error_len().is_none() => {
            Some(String::from_utf8_lossy(&bytes[..e.valid_up_to()]).into_owned())
        }
        Err(_) => Some(bytes.iter().copied().map(windows_1252).collect()),
    }
}

fn decode_utf16(bytes: &[u8], unit: fn([u8; 2]) -> u16) -> String {
    let units = bytes.chunks_exact(2).map(|b| unit([b[0], b[1]]));
    char::decode_utf16(units)
        .map(|c| c.unwrap_or(char::REPLACEMENT_CHARACTER))
        .collect()
}

/// Windows-1252 differs from Latin-1 only in 0x80 to 0x9F.
fn windows_1252(byte: u8) -> char {
    const HIGH: [char; 32] = [
        '€', '\u{81}', '‚', 'ƒ', '„', '…', '†', '‡', 'ˆ', '‰', 'Š', '‹', 'Œ', '\u{8D}', 'Ž',
        '\u{8F}', '\u{90}', '‘', '’', '“', '”', '•', '–', '—', '˜', '™', 'š', '›', 'œ', '\u{9D}',
        'ž', 'Ÿ',
    ];
    match byte {
        0x80..=0x9F => HIGH[usize::from(byte - 0x80)],
        _ => char::from(byte),
    }
}

/// The words of a question worth searching for: lowercase, 3+ characters,
/// no filler, and plurals folded so "budgets" finds "budget".
pub fn search_terms(question: &str) -> Vec<String> {
    let lower = question.to_lowercase();
    let mut terms: Vec<String> = Vec::new();
    for word in lower.split(|c: char| !c.is_alphanumeric()) {
        if word.chars().count() < 3 || STOP_WORDS.contains(&word) {
            continue;
        }
        let singular = match word.strip_suffix('s') {
            Some(stem) if !stem.ends_with('s') && stem.chars().count() >= 3 => stem,
            _ => word,
        };
        if !terms.iter().any(|t| t == singular) {
            terms.push(singular.to_string());
        }
    }
    terms
}

/// Cut a file into passages at line ends, splitting only lines too long to fit.
fn chunks(text: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut current = String::new();
    let mut count = 0;
    for line in text.split_inclusive('\n') {
        let length = line.chars().count();
        if count > 0 && count + length > CHUNK_CHARS {
            out.push(std::mem::take(&mut current));
            count = 0;
        }
        if length > CHUNK_CHARS {
            let chars: Vec<char> = line.chars().collect();
            out.extend(chars.chunks(CHUNK_CHARS).map(|c| c.iter().collect::<String>()));
            continue;
        }
        current.push_str(line);
        count += length;
    }
    if count > 0 {
        out.push(current);
    }
    out.retain(|c| !c.trim().is_empty());
    out
}

/// The passages that best match `terms`, best first, within `max_chars`.
/// A word found in few passages counts for more than one found everywhere,
/// and a word in the file's name counts a little even if the text lacks it.
pub fn best_excerpts(docs: &[Doc], terms: &[String], max_chars: usize) -> Vec<Excerpt> {
    if terms.is_empty() {
        return Vec::new();
    }
    let passages: Vec<(usize, String, String)> = docs
        .iter()
        .enumerate()
        .flat_map(|(i, doc)| chunks(&doc.text).into_iter().map(move |c| (i, c.to_lowercase(), c)))
        .collect();
    let total = passages.len() as f64;
    let weights: Vec<f64> = terms
        .iter()
        .map(|t| {
            let found = passages.iter().filter(|(_, lower, _)| lower.contains(t.as_str())).count();
            (1.0 + total / (1.0 + found as f64)).ln()
        })
        .collect();
    let paths: Vec<String> = docs.iter().map(|d| d.path.to_lowercase()).collect();

    let mut scored: Vec<(f64, usize)> = passages
        .iter()
        .enumerate()
        .map(|(index, (doc, lower, _))| {
            let score: f64 = terms
                .iter()
                .zip(&weights)
                .map(|(term, weight)| {
                    let in_text = if lower.contains(term.as_str()) { *weight } else { 0.0 };
                    let in_name = if paths[*doc].contains(term.as_str()) { weight * 0.5 } else { 0.0 };
                    in_text + in_name
                })
                .sum();
            (score, index)
        })
        .filter(|(score, _)| *score > 0.0)
        .collect();
    scored.sort_by(|a, b| b.0.total_cmp(&a.0).then(a.1.cmp(&b.1)));

    let top = scored.first().map_or(0.0, |s| s.0);
    let mut used = 0;
    let mut out = Vec::new();
    for (score, index) in scored {
        if score < top * KEEP_RATIO || out.len() == MAX_EXCERPTS {
            break;
        }
        let (doc, _, text) = &passages[index];
        let length = text.chars().count();
        if used + length > max_chars {
            continue;
        }
        used += length;
        out.push(Excerpt { path: docs[*doc].path.clone(), text: text.trim().to_string() });
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn doc(path: &str, text: &str) -> Doc {
        Doc { path: path.into(), text: text.into() }
    }

    #[test]
    fn reads_utf8_with_and_without_a_bom() {
        assert_eq!(decode_text("plain".as_bytes()).as_deref(), Some("plain"));
        assert_eq!(decode_text(b"\xEF\xBB\xBFbom").as_deref(), Some("bom"));
    }

    #[test]
    fn reads_windows_formats() {
        let mut utf16: Vec<u8> = vec![0xFF, 0xFE];
        utf16.extend("Fuel 6,350".encode_utf16().flat_map(u16::to_le_bytes));
        assert_eq!(decode_text(&utf16).as_deref(), Some("Fuel 6,350"));

        let mut big: Vec<u8> = vec![0xFE, 0xFF];
        big.extend("Fuel".encode_utf16().flat_map(u16::to_be_bytes));
        assert_eq!(decode_text(&big).as_deref(), Some("Fuel"));

        assert_eq!(decode_text(b"Caf\xE9 \x80 5").as_deref(), Some("Café € 5"));
    }

    #[test]
    fn a_read_cut_inside_a_character_keeps_the_rest() {
        assert_eq!(decode_text(b"caf\xC3").as_deref(), Some("caf"));
    }

    #[test]
    fn binary_is_not_text() {
        assert_eq!(decode_text(b"\x89PNG\x00\x01"), None);
    }

    #[test]
    fn terms_drop_filler_and_fold_plurals() {
        assert_eq!(
            search_terms("What is the marketing budgets for 2026?"),
            ["marketing", "budget", "2026"]
        );
        assert!(search_terms("List the file names in my connected folder.").is_empty());
        assert_eq!(search_terms("glass class"), ["glass", "class"]);
    }

    #[test]
    fn long_lines_are_split_and_nothing_is_lost() {
        let text = format!("short\n{}\nend", "x".repeat(2000));
        let parts = chunks(&text);
        assert!(parts.iter().all(|p| p.chars().count() <= CHUNK_CHARS));
        assert_eq!(parts.concat(), text);
    }

    #[test]
    fn finds_a_fact_deep_inside_a_long_file() {
        let filler = "filler words here\n".repeat(400);
        let docs = [doc("report.txt", &format!("{filler}The final invoice number is INV-55120.\n{filler}"))];
        let found = best_excerpts(&docs, &search_terms("What is the final invoice number?"), 4000);
        assert!(found[0].text.contains("INV-55120"));
    }

    #[test]
    fn the_rarer_word_decides() {
        let docs = [
            doc("a.txt", "The budget meeting is on Monday."),
            doc("b.txt", "The budget review is on Friday."),
            doc("c.txt", "The marketing budget is 48,250 rupees."),
        ];
        let found = best_excerpts(&docs, &search_terms("marketing budget"), 4000);
        assert_eq!(found[0].path, "c.txt");
    }

    #[test]
    fn nothing_matching_sends_nothing() {
        let docs = [doc("a.txt", "lorem ipsum")];
        assert!(best_excerpts(&docs, &search_terms("capital of Japan"), 4000).is_empty());
    }

    #[test]
    fn stays_within_the_budget_and_the_excerpt_limit() {
        let docs: Vec<Doc> = (0..9)
            .map(|i| doc(&format!("{i}.txt"), &format!("harbour {}\n", "note ".repeat(100))))
            .collect();
        let terms = search_terms("harbour");
        assert_eq!(best_excerpts(&docs, &terms, 100_000).len(), MAX_EXCERPTS);
        assert_eq!(best_excerpts(&docs, &terms, 600).len(), 1);
    }
}
