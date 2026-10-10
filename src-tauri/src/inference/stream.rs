//! Turning the model's raw token stream into text the UI can show.
//!
//! Three small, engine-independent pieces live here so they can be unit
//! tested without loading a model:
//!
//! * [`Utf8Assembler`] — tokens are byte fragments; a multi-byte character
//!   (an emoji, most non-Latin scripts) can be split across two tokens.
//! * [`ReplyFilter`] — reasoning models write their thinking between marker
//!   tags before the answer; the two are streamed to the UI separately.
//! * [`is_stuck`] — a last-resort guard against a model looping forever.

/// Buffers token bytes and releases only complete UTF-8 text.
#[derive(Default)]
pub struct Utf8Assembler {
    pending: Vec<u8>,
}

impl Utf8Assembler {
    /// Add a token's bytes; returns whatever text is now complete.
    pub fn push(&mut self, bytes: &[u8]) -> String {
        self.pending.extend_from_slice(bytes);
        let mut out = String::new();
        loop {
            match std::str::from_utf8(&self.pending) {
                Ok(text) => {
                    out.push_str(text);
                    self.pending.clear();
                    return out;
                }
                Err(err) => {
                    let valid = err.valid_up_to();
                    out.push_str(&String::from_utf8_lossy(&self.pending[..valid]));
                    match err.error_len() {
                        // A sequence that can never become valid: replace
                        // it and keep going with the rest.
                        Some(bad) => {
                            out.push('\u{FFFD}');
                            self.pending.drain(..valid + bad);
                        }
                        // An incomplete character at the end: wait for the
                        // next token to finish it.
                        None => {
                            self.pending.drain(..valid);
                            return out;
                        }
                    }
                }
            }
        }
    }

    /// Discard a dangling partial character at the end of generation.
    pub fn reset(&mut self) {
        self.pending.clear();
    }
}

/// A piece of reply text, tagged by which part of the reply it belongs to.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Chunk {
    /// The model's visible answer.
    Answer(String),
    /// The model's private reasoning, shown collapsed in the UI.
    Reasoning(String),
}

/// Tags that open a reasoning section. Longer alternatives of the same tag
/// come first so the channel name is swallowed with it.
const OPEN_MARKERS: &[&str] = &["<think>", "<|channel>thought\n", "<|channel>thought", "<|channel>"];
/// Tags that close a reasoning section.
const CLOSE_MARKERS: &[&str] = &["</think>", "<channel|>"];

/// True if `prompt` ends inside an open reasoning section — some templates
/// open the thinking tag themselves, so the model's first token is already
/// reasoning.
pub fn prompt_opens_reasoning(prompt: &str) -> bool {
    let tail = prompt.trim_end();
    OPEN_MARKERS.iter().any(|m| tail.ends_with(m.trim_end()))
}

/// Whether a control token's text is one of the reasoning tags (and so must
/// reach the filter rather than being hidden like other control tokens).
pub fn is_reasoning_marker(piece: &str) -> bool {
    let piece = piece.trim();
    OPEN_MARKERS.iter().chain(CLOSE_MARKERS).any(|m| m.trim() == piece)
}

/// Splits a streamed reply into reasoning and answer.
///
/// Text is released as soon as it cannot be part of a marker; at most a few
/// characters are ever held back.
pub struct ReplyFilter {
    in_reasoning: bool,
    /// Reasoning may only open before the answer has begun, so a literal
    /// "<think>" in the middle of an answer is left alone.
    answer_started: bool,
    /// Leading whitespace of each section is dropped.
    section_started: bool,
    pending: String,
}

impl ReplyFilter {
    pub fn new(starts_in_reasoning: bool) -> Self {
        Self {
            in_reasoning: starts_in_reasoning,
            answer_started: false,
            section_started: false,
            pending: String::new(),
        }
    }

    pub fn push(&mut self, text: &str, out: &mut Vec<Chunk>) {
        self.pending.push_str(text);
        self.drain(false, out);
    }

    pub fn finish(&mut self, out: &mut Vec<Chunk>) {
        self.drain(true, out);
    }

    fn markers(&self) -> &'static [&'static str] {
        if self.in_reasoning {
            CLOSE_MARKERS
        } else if self.answer_started {
            &[]
        } else {
            OPEN_MARKERS
        }
    }

    fn emit(&mut self, text: &str, out: &mut Vec<Chunk>) {
        let text = if self.section_started { text } else { text.trim_start() };
        if text.is_empty() {
            return;
        }
        self.section_started = true;
        if self.in_reasoning {
            out.push(Chunk::Reasoning(text.to_string()));
        } else {
            self.answer_started = true;
            out.push(Chunk::Answer(text.to_string()));
        }
    }

    fn drain(&mut self, at_end: bool, out: &mut Vec<Chunk>) {
        loop {
            let markers = self.markers();
            let pending = std::mem::take(&mut self.pending);
            let mut search_from = 0;
            let mut resolved = false;

            while let Some(offset) = pending[search_from..].find('<') {
                let at = search_from + offset;
                let rest = &pending[at..];

                // More text could still turn `rest` into a (longer) marker.
                let undecided =
                    !at_end && markers.iter().any(|m| m.len() > rest.len() && m.starts_with(rest));
                if undecided {
                    self.emit(&pending[..at], out);
                    self.pending = rest.to_string();
                    return;
                }

                if let Some(marker) = markers.iter().find(|m| rest.starts_with(**m)) {
                    self.emit(&pending[..at], out);
                    self.in_reasoning = !self.in_reasoning;
                    self.section_started = false;
                    self.pending = rest[marker.len()..].to_string();
                    resolved = true;
                    break;
                }
                search_from = at + 1;
            }

            if !resolved {
                self.emit(&pending, out);
                return;
            }
        }
    }
}

/// How many trailing tokens must repeat exactly before generation is cut.
const STUCK_WINDOW: usize = 256;
/// Longest repeating unit that is checked for.
const STUCK_MAX_PERIOD: usize = 32;

/// True when the tail of `tokens` is one short pattern repeated over and
/// over — a model that has fallen into a loop it will not leave.
///
/// The bar is deliberately high (256 tokens of exact repetition). Tables,
/// code and lists repeat short patterns legitimately, and cutting those
/// off is worse than letting a rare runaway reach its length limit.
pub fn is_stuck(tokens: &[i32]) -> bool {
    (1..=STUCK_MAX_PERIOD).any(|period| {
        if tokens.len() < STUCK_WINDOW + period {
            return false;
        }
        let tail = &tokens[tokens.len() - STUCK_WINDOW - period..];
        tail.iter().zip(&tail[period..]).all(|(a, b)| a == b)
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn run(start_in_reasoning: bool, pieces: &[&str]) -> (String, String) {
        let mut filter = ReplyFilter::new(start_in_reasoning);
        let mut chunks = Vec::new();
        for piece in pieces {
            filter.push(piece, &mut chunks);
        }
        filter.finish(&mut chunks);
        let mut reasoning = String::new();
        let mut answer = String::new();
        for chunk in chunks {
            match chunk {
                Chunk::Reasoning(t) => reasoning.push_str(&t),
                Chunk::Answer(t) => answer.push_str(&t),
            }
        }
        (reasoning, answer)
    }

    #[test]
    fn plain_answers_pass_through() {
        let (reasoning, answer) = run(false, &["Hello", ", ", "world"]);
        assert_eq!(reasoning, "");
        assert_eq!(answer, "Hello, world");
    }

    #[test]
    fn think_tags_split_reasoning_from_answer() {
        let (reasoning, answer) = run(false, &["<think>", "\nadd them", "\n</think>", "\n\n4"]);
        assert_eq!(reasoning, "add them\n");
        assert_eq!(answer, "4");
    }

    #[test]
    fn markers_split_across_tokens_are_found() {
        let (reasoning, answer) = run(false, &["<", "thi", "nk>plan<", "/th", "ink>", "done"]);
        assert_eq!(reasoning, "plan");
        assert_eq!(answer, "done");
    }

    #[test]
    fn prompt_can_open_reasoning() {
        assert!(prompt_opens_reasoning("<|im_start|>assistant\n<think>\n"));
        assert!(prompt_opens_reasoning("<|turn>model\n<|channel>thought\n"));
        assert!(!prompt_opens_reasoning("<|im_start|>assistant\n<think>\n\n</think>\n\n"));
        assert!(!prompt_opens_reasoning("<|im_start|>assistant\n"));

        let (reasoning, answer) = run(true, &["weigh it", "</think>", "Yes."]);
        assert_eq!(reasoning, "weigh it");
        assert_eq!(answer, "Yes.");
    }

    #[test]
    fn gemma_channel_tags_are_understood() {
        let (reasoning, answer) = run(false, &["<|channel>", "thought\n", "step 1", "<channel|>", "Answer"]);
        assert_eq!(reasoning, "step 1");
        assert_eq!(answer, "Answer");
    }

    #[test]
    fn angle_brackets_in_answers_are_kept() {
        let (reasoning, answer) = run(false, &["Use a ", "<div>", " and 1 < 2, or <think> later"]);
        assert_eq!(reasoning, "");
        assert_eq!(answer, "Use a <div> and 1 < 2, or <think> later");
    }

    #[test]
    fn unfinished_marker_is_flushed_at_the_end() {
        let (_, answer) = run(false, &["ok <thi"]);
        assert_eq!(answer, "ok <thi");
    }

    #[test]
    fn reasoning_marker_tokens_are_recognised() {
        assert!(is_reasoning_marker("<think>"));
        assert!(is_reasoning_marker("</think>"));
        assert!(is_reasoning_marker("<|channel>"));
        assert!(is_reasoning_marker("<channel|>"));
        assert!(!is_reasoning_marker("<|im_end|>"));
    }

    #[test]
    fn utf8_split_across_tokens_is_reassembled() {
        let bytes = "héllo 🙂".as_bytes();
        let mut assembler = Utf8Assembler::default();
        let mut out = String::new();
        for chunk in bytes.chunks(1) {
            out.push_str(&assembler.push(chunk));
        }
        assert_eq!(out, "héllo 🙂");
    }

    #[test]
    fn invalid_bytes_do_not_stall_the_stream() {
        let mut assembler = Utf8Assembler::default();
        let out = assembler.push(&[b'a', 0xFF, b'b']);
        assert_eq!(out, "a\u{FFFD}b");
    }

    #[test]
    fn only_long_exact_loops_count_as_stuck() {
        let looping: Vec<i32> = (0..400).map(|i| i % 3).collect();
        assert!(is_stuck(&looping));

        // A table separator row or a short repeated phrase is not a loop.
        let mut table: Vec<i32> = (0..200).collect();
        table.extend(std::iter::repeat([7, 8]).take(30).flatten());
        assert!(!is_stuck(&table));

        let varied: Vec<i32> = (0..1000).collect();
        assert!(!is_stuck(&varied));
        assert!(!is_stuck(&[1, 1, 1]));
    }
}
