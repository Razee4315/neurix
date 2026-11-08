//! Adding a model from a Hugging Face link: reading the link, checking the
//! repository and its files against what Neurix can run, and describing
//! the result so the user can pick a file.
//!
//! Everything here talks to `huggingface.co` only. Links to other sites are
//! refused before any request is made.

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use super::catalog::{ModelInfo, Reasoning, SamplingDefaults};

pub const HF_ORIGIN: &str = "https://huggingface.co";

/// Largest file Neurix will even consider. Nothing it runs on can load more.
const ABSOLUTE_MAX_BYTES: u64 = 40_000_000_000;

/// Architectures the bundled llama.cpp can run as a chat model. Taken from
/// `LLM_ARCH_NAMES` in llama.cpp's `src/llama-arch.cpp` for llama-cpp-sys-2
/// 0.1.159; refresh both lists when that crate is updated.
const CHAT_ARCHITECTURES: &[&str] = &[
    "llama", "llama4", "deci", "falcon", "grok", "gpt2", "gptj", "gptneox", "mpt", "baichuan",
    "starcoder", "refact", "bloom", "stablelm", "qwen", "qwen2", "qwen2moe", "qwen2vl", "qwen3",
    "qwen3moe", "qwen3next", "qwen3vl", "qwen3vlmoe", "qwen35", "qwen35moe", "qwen4exp", "phi2",
    "phi3", "phimoe", "plamo", "plamo2", "plamo3", "codeshell", "orion", "internlm2", "minicpm",
    "minicpm3", "gemma", "gemma2", "gemma3", "gemma3n", "gemma4", "starcoder2", "mamba", "mamba2",
    "maple", "jamba", "falcon-h1", "xverse", "command-r", "cohere2", "cohere2moe", "dbrx", "olmo",
    "olmo2", "olmoe", "muse-glimmer", "openelm", "arctic", "deepseek", "deepseek2", "deepseek32",
    "deepseek4", "chatglm", "glm4", "glm4moe", "glm-dsa", "bitnet", "jais", "jais2", "nemotron",
    "nemotron_h", "nemotron_h_moe", "exaone", "exaone4", "exaone-moe", "rwkv6", "rwkv6qwen2",
    "rwkv7", "arwkv7", "granite", "granitemoe", "granitehybrid", "graniteswitch", "granite_swa",
    "chameleon", "plm", "bailingmoe", "bailingmoe2", "bailingmoe3", "dots1", "dots3note", "arcee",
    "afmoe", "laguna", "ernie4_5", "ernie4_5-moe", "hunyuan-moe", "hunyuan-dense", "hunyuan_vl",
    "hy_v3", "hy_v4", "smollm3", "gpt-oss", "lfm2", "lfm2moe", "dream", "smallthinker", "llada",
    "llada-moe", "seed_oss", "grovemoe", "apertus", "minimax-01", "hrm_text", "minimax-m2",
    "minimax-m3", "cogvlm", "rnd1", "pangu-embedded", "mistral3", "mistral4", "mimo2", "step35",
    "spark2_5", "maincoder", "kimi-linear", "kimi-k3", "talkie", "mellum", "nanbeige",
];

/// Architectures llama.cpp knows that are not chat models: embedding,
/// vision, speech and draft models.
const OTHER_ARCHITECTURES: &[&str] = &[
    "clip", "bert", "modern-bert", "nomic-bert", "nomic-bert-moe", "neo-bert", "jina-bert-v2",
    "jina-bert-v3", "eurobert", "t5", "t5encoder", "gemma-embedding", "gemma4-assistant",
    "wavtokenizer-dec", "llama-embed", "qwen3tts", "pockettts", "eagle3", "dflash",
    "deepseek2-ocr", "paddleocr",
];

#[derive(Debug, PartialEq, Eq)]
pub enum ArchSupport {
    Chat,
    NotChat,
    Unsupported,
}

pub fn architecture_support(arch: &str) -> ArchSupport {
    let arch = arch.trim().to_ascii_lowercase();
    if CHAT_ARCHITECTURES.contains(&arch.as_str()) {
        ArchSupport::Chat
    } else if OTHER_ARCHITECTURES.contains(&arch.as_str()) {
        ArchSupport::NotChat
    } else {
        ArchSupport::Unsupported
    }
}

/// Why a model with this architecture cannot be added, if it cannot.
pub fn architecture_problem(arch: &str) -> Option<String> {
    match architecture_support(arch) {
        ArchSupport::Chat => None,
        ArchSupport::NotChat => Some(format!(
            "This is not a chat model (its type is \u{201c}{arch}\u{201d}: an embedding, vision, speech or helper model), so Neurix can't hold a conversation with it."
        )),
        ArchSupport::Unsupported => Some(format!(
            "This model is built on the \u{201c}{arch}\u{201d} architecture, which this version of Neurix can't run."
        )),
    }
}

/// What a pasted link points at.
#[derive(Debug, PartialEq, Eq)]
pub struct HfLink {
    /// "owner/name".
    pub repo: String,
    /// A file inside the repository, when the link named one.
    pub file: Option<String>,
    /// A quantization asked for with llama.cpp's "owner/name:Q4_K_M" form.
    pub quant: Option<String>,
}

const NOT_HF: &str = "Only links to models on huggingface.co can be added. Open the model's page on Hugging Face and copy the address from there.";

/// Read a link the user pasted. Accepts a model page, a file page or a
/// download link on huggingface.co (or hf.co), and the short
/// "owner/name" form, with or without a ":QUANT" tag.
pub fn parse_link(input: &str) -> Result<HfLink, String> {
    let mut text = input.trim();
    if text.is_empty() {
        return Err("Paste a link to a model on Hugging Face.".to_string());
    }
    if text.contains(char::is_whitespace) {
        return Err("That doesn't look like a link. Paste just the address of the model's page.".to_string());
    }
    // Query and fragment never matter here.
    if let Some(i) = text.find(['?', '#']) {
        text = &text[..i];
    }

    let has_scheme = text.contains("://");
    let rest = if has_scheme {
        let (scheme, rest) = text.split_once("://").unwrap_or(("", text));
        if !scheme.eq_ignore_ascii_case("https") && !scheme.eq_ignore_ascii_case("http") {
            return Err(NOT_HF.to_string());
        }
        rest
    } else {
        text
    };

    let mut segments: Vec<&str> = rest.split('/').filter(|s| !s.is_empty()).collect();
    if segments.is_empty() {
        return Err(NOT_HF.to_string());
    }
    // A host is present when there was a scheme, or the first segment looks
    // like a domain.
    if has_scheme || segments[0].contains('.') {
        let host = segments.remove(0).to_ascii_lowercase();
        let host = host.strip_prefix("www.").unwrap_or(&host);
        if host != "huggingface.co" && host != "hf.co" {
            return Err(NOT_HF.to_string());
        }
    }

    match segments.first().copied() {
        None => return Err("Paste the link of one model's page, not the Hugging Face home page.".to_string()),
        Some("datasets") => return Err("That link is to a dataset, not a model.".to_string()),
        Some("spaces") => return Err("That link is to a Space (a web app), not a model you can download.".to_string()),
        Some("models" | "collections" | "docs" | "blog" | "api" | "papers" | "settings" | "join" | "login") => {
            return Err("Paste the link of one model's page, not a list or a help page.".to_string())
        }
        _ => {}
    }
    if segments.len() < 2 {
        return Err("That link doesn't name a model. A model's link looks like huggingface.co/owner/model-name.".to_string());
    }

    let owner = segments[0];
    let (name, quant) = match segments[1].split_once(':') {
        Some((name, quant)) => (name, Some(quant.to_ascii_uppercase())),
        None => (segments[1], None),
    };
    if !valid_repo_part(owner) || !valid_repo_part(name) {
        return Err("That link doesn't name a model. A model's link looks like huggingface.co/owner/model-name.".to_string());
    }

    // ".../blob/main/file.gguf" and ".../resolve/main/file.gguf" name a file;
    // ".../tree/main" and ".../tree/main/folder" do not.
    let file = match segments.get(2).copied() {
        Some("blob" | "resolve") if segments.len() > 4 => {
            let joined = segments[4..].join("/");
            Some(percent_decode(&joined).ok_or_else(|| "That file link is damaged. Copy it again from Hugging Face.".to_string())?)
        }
        _ => None,
    };
    if let Some(f) = &file {
        if !valid_filename(f) {
            return Err(if f.to_ascii_lowercase().ends_with(".gguf") {
                "That file's name has characters Neurix can't download. Pick another file from the model's page.".to_string()
            } else {
                "That file isn't a GGUF model file. Paste the link of the model's page instead, and Neurix will list the files it can use.".to_string()
            });
        }
    }

    Ok(HfLink { repo: format!("{owner}/{name}"), file, quant })
}

fn valid_repo_part(part: &str) -> bool {
    !part.is_empty()
        && part.len() <= 96
        && !part.starts_with('.')
        && !part.contains("..")
        && part.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'))
}

pub fn valid_repo(repo: &str) -> bool {
    match repo.split_once('/') {
        Some((owner, name)) => valid_repo_part(owner) && valid_repo_part(name),
        None => false,
    }
}

/// A file path inside a repository that can go into a download URL as is:
/// a GGUF, plain characters only, no empty or parent segments.
pub fn valid_filename(name: &str) -> bool {
    name.len() <= 255
        && name.to_ascii_lowercase().ends_with(".gguf")
        && name.split('/').all(|s| !s.is_empty() && s != "." && s != "..")
        && name.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.' | '/'))
}

fn percent_decode(text: &str) -> Option<String> {
    let bytes = text.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' {
            let hex = text.get(i + 1..i + 3)?;
            out.push(u8::from_str_radix(hex, 16).ok()?);
            i += 3;
        } else {
            out.push(bytes[i]);
            i += 1;
        }
    }
    String::from_utf8(out).ok()
}

/// One part of a model split across several files ("-00001-of-00003").
pub fn is_split_part(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    let Some(stem) = lower.strip_suffix(".gguf") else { return false };
    let Some((head, total)) = stem.rsplit_once("-of-") else { return false };
    let part = head.rsplit('-').next().unwrap_or("");
    part.len() == 5
        && total.len() == 5
        && part.bytes().all(|b| b.is_ascii_digit())
        && total.bytes().all(|b| b.is_ascii_digit())
}

/// A vision projector that ships next to a multimodal model. Not a model.
pub fn is_projector(name: &str) -> bool {
    let lower = name.rsplit('/').next().unwrap_or(name).to_ascii_lowercase();
    lower.contains("mmproj") || lower.contains("projector")
}

/// Quantization names, longest first so "Q4_K_M" wins over "Q4_K".
const QUANTS: &[&str] = &[
    "IQ2_XXS", "IQ3_XXS", "Q3_K_XL", "Q4_K_XL", "Q5_K_XL", "Q6_K_XL", "Q8_K_XL", "IQ1_S", "IQ1_M",
    "IQ2_XS", "IQ2_S", "IQ2_M", "IQ3_XS", "IQ3_S", "IQ3_M", "IQ4_XS", "IQ4_NL", "Q2_K_S", "Q2_K_L",
    "Q3_K_S", "Q3_K_M", "Q3_K_L", "Q4_K_S", "Q4_K_M", "Q4_K_L", "Q4_K_P", "Q5_K_S", "Q5_K_M",
    "Q5_K_L", "Q6_K_L", "Q6_K_P", "TQ1_0", "TQ2_0", "MXFP4", "Q2_K", "Q3_K", "Q4_K", "Q4_0",
    "Q4_1", "Q5_K", "Q5_0", "Q5_1", "Q6_K", "Q8_0", "BF16", "F16", "F32",
];

/// The quantization named in a file name, e.g. "Q4_K_M".
pub fn quant_of(filename: &str) -> Option<&'static str> {
    let base = filename.rsplit('/').next().unwrap_or(filename);
    let upper = base.to_ascii_uppercase();
    let upper = upper.strip_suffix(".GGUF").unwrap_or(&upper);
    let bytes = upper.as_bytes();
    QUANTS.iter().copied().find(|q| {
        upper.match_indices(q).any(|(i, _)| {
            let before = i.checked_sub(1).map(|j| bytes[j]);
            let after = bytes.get(i + q.len()).copied();
            let edge = |b: Option<u8>| b.map(|b| !b.is_ascii_alphanumeric()).unwrap_or(true);
            edge(before) && edge(after)
        })
    })
}

/// "Q4_K_M (4-bit)", the way the catalog writes it.
pub fn quant_label(quant: Option<&str>) -> String {
    match quant {
        None => "Unknown".to_string(),
        Some(q) => {
            let bits: String = q
                .trim_start_matches(|c: char| c.is_ascii_alphabetic())
                .chars()
                .take_while(|c| c.is_ascii_digit())
                .collect();
            if q == "MXFP4" {
                "MXFP4 (4-bit)".to_string()
            } else if bits.is_empty() {
                q.to_string()
            } else {
                format!("{q} ({bits}-bit)")
            }
        }
    }
}

/// Memory, in GB as devices are sold, a model file needs to run
/// comfortably: the weights plus room for the context and the system.
/// Matches the catalog's ratings (a 2.7 GB file needs an 8 GB device).
pub fn min_ram_gb(size_bytes: u64) -> u32 {
    let gb = size_bytes as f64 / 1e9;
    (gb * 2.0 + 2.0).ceil() as u32
}

/// Why a file is too big to be worth downloading on this device, if it is.
/// Past ~70% of the device's memory it would not load at all.
pub fn size_problem(size_bytes: u64, ram_bytes: Option<u64>) -> Option<String> {
    if size_bytes > ABSOLUTE_MAX_BYTES {
        return Some(format!(
            "At {} this model is far too large for any phone or laptop to run.",
            size_label(size_bytes)
        ));
    }
    let ram = ram_bytes?;
    if size_bytes > ram / 10 * 7 {
        return Some(format!(
            "At {} this model is too big for this device's {} GB of memory. Pick a smaller file or a model with fewer parameters.",
            size_label(size_bytes),
            ram.div_ceil(1 << 30)
        ));
    }
    None
}

/// How well a file suits this device, in the store's terms.
pub fn fit(size_bytes: u64, ram_bytes: Option<u64>) -> &'static str {
    let Some(ram) = ram_bytes else { return "unknown" };
    let have = ram.div_ceil(1 << 30) as u32;
    let need = min_ram_gb(size_bytes);
    if have >= need {
        "good"
    } else if have + 2 >= need {
        "tight"
    } else {
        "too_big"
    }
}

/// "840 MB", "2.7 GB".
pub fn size_label(size_bytes: u64) -> String {
    if size_bytes < 1_000_000_000 {
        format!("{} MB", (size_bytes as f64 / 1e6 / 10.0).round() as u64 * 10)
    } else {
        format!("{:.1} GB", size_bytes as f64 / 1e9)
    }
}

/// "30.5B", "800M".
fn parameters_label(count: u64) -> String {
    if count >= 1_000_000_000 {
        let b = count as f64 / 1e9;
        if b >= 10.0 { format!("{b:.0}B") } else { format!("{b:.1}B") }
    } else {
        format!("{}M", count / 1_000_000)
    }
}

/// A stable, path-safe id for a file added from Hugging Face.
pub fn added_id(repo: &str, filename: &str) -> String {
    let stem = filename.strip_suffix(".gguf").or_else(|| filename.strip_suffix(".GGUF")).unwrap_or(filename);
    let mut slug = String::new();
    for c in format!("{repo}-{stem}").chars() {
        let c = c.to_ascii_lowercase();
        if c.is_ascii_alphanumeric() || (c == '.' && !slug.ends_with('.')) {
            slug.push(c);
        } else if c == '.' {
            continue;
        } else if !slug.ends_with('-') {
            slug.push('-');
        }
    }
    let slug: String = slug.trim_matches(['-', '.']).chars().take(60).collect();
    let slug = slug.trim_end_matches(['-', '.']);
    let hash = Sha256::digest(format!("{repo}/{filename}").as_bytes());
    let short: String = hash.iter().take(4).map(|b| format!("{b:02x}")).collect();
    format!("hf-{slug}-{short}")
}

/// Sampling for an added model, from its architecture's family.
fn sampling_for(arch: Option<&str>) -> SamplingDefaults {
    let arch = arch.unwrap_or("");
    if arch.starts_with("qwen") {
        super::catalog::QWEN
    } else if arch.starts_with("gemma") {
        super::catalog::GEMMA
    } else if arch.starts_with("lfm") {
        super::catalog::LFM
    } else {
        super::catalog::GENERIC
    }
}

// ── The Hugging Face API ────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ApiModel {
    pub id: String,
    #[serde(default)]
    pub gated: serde_json::Value,
    #[serde(default)]
    pub private: bool,
    #[serde(default)]
    pub disabled: bool,
    #[serde(default)]
    pub siblings: Vec<ApiFile>,
    #[serde(default)]
    pub gguf: Option<ApiGguf>,
    #[serde(default, rename = "cardData")]
    pub card_data: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct ApiFile {
    pub rfilename: String,
    #[serde(default)]
    pub size: Option<u64>,
    #[serde(default)]
    pub lfs: Option<ApiLfs>,
}

#[derive(Debug, Deserialize)]
pub struct ApiLfs {
    #[serde(default)]
    pub sha256: Option<String>,
    #[serde(default)]
    pub size: Option<u64>,
}

#[derive(Debug, Deserialize)]
pub struct ApiGguf {
    #[serde(default)]
    pub architecture: Option<String>,
    #[serde(default)]
    pub context_length: Option<u64>,
    #[serde(default)]
    pub total: Option<u64>,
    #[serde(default)]
    pub chat_template: Option<String>,
}

impl ApiFile {
    pub fn size(&self) -> Option<u64> {
        self.lfs.as_ref().and_then(|l| l.size).or(self.size)
    }

    pub fn sha256(&self) -> Option<String> {
        let hash = self.lfs.as_ref()?.sha256.as_ref()?.to_ascii_lowercase();
        (hash.len() == 64 && hash.bytes().all(|b| b.is_ascii_hexdigit())).then_some(hash)
    }
}

impl ApiModel {
    pub fn is_gated(&self) -> bool {
        !matches!(self.gated, serde_json::Value::Null | serde_json::Value::Bool(false))
    }

    fn license(&self) -> Option<String> {
        self.card_data.as_ref()?.get("license")?.as_str().map(str::to_string)
    }

    fn architecture(&self) -> Option<&str> {
        self.gguf.as_ref()?.architecture.as_deref()
    }

    /// GGUF files someone could pick: single-file models only.
    fn model_files(&self) -> impl Iterator<Item = &ApiFile> {
        self.siblings
            .iter()
            .filter(|f| f.rfilename.to_ascii_lowercase().ends_with(".gguf") && !is_projector(&f.rfilename))
    }
}

/// Problems with the repository as a whole, before looking at files.
pub fn repo_problem(model: &ApiModel) -> Option<String> {
    if model.disabled {
        return Some("Hugging Face has disabled this model, so it can't be downloaded.".to_string());
    }
    if model.private {
        return Some("This model is private, so it can't be downloaded.".to_string());
    }
    if model.is_gated() {
        return Some("This model's authors ask you to sign in and accept their terms on Hugging Face before downloading, which Neurix can't do. Search Hugging Face for another GGUF upload of it.".to_string());
    }
    if model.model_files().next().is_none() {
        return Some("This model has no GGUF files, and GGUF is the only format Neurix can run. Many models have a separate GGUF upload: search Hugging Face for the model's name followed by \u{201c}GGUF\u{201d}.".to_string());
    }
    if let Some(problem) = model.architecture().and_then(architecture_problem) {
        return Some(problem);
    }
    None
}

#[derive(Debug, Clone, Serialize)]
pub struct HubFile {
    pub filename: String,
    pub size_bytes: u64,
    pub size_label: String,
    pub quantization: String,
    pub min_ram_gb: u32,
    /// "good" | "tight" | "too_big" | "unknown", as in the store.
    pub fit: String,
    /// Why this file cannot be added, when it cannot.
    pub problem: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct HubModel {
    pub repo: String,
    pub author: String,
    pub name: String,
    pub architecture: Option<String>,
    pub parameters: Option<String>,
    pub license: Option<String>,
    /// Without a chat template the model may not follow a conversation.
    pub has_chat_template: bool,
    pub files: Vec<HubFile>,
    /// The file to select first: the one the link named, else the best fit.
    pub selected: Option<String>,
}

fn file_problem(file: &ApiFile, ram_bytes: Option<u64>) -> Option<String> {
    if is_split_part(&file.rfilename) {
        return Some("Split into several files, which Neurix can't download.".to_string());
    }
    if !valid_filename(&file.rfilename) {
        return Some("The file name has characters Neurix can't download.".to_string());
    }
    let Some(size) = file.size() else {
        return Some("Hugging Face doesn't list this file's size.".to_string());
    };
    if file.sha256().is_none() {
        return Some("Hugging Face doesn't list a checksum, so the download couldn't be verified.".to_string());
    }
    size_problem(size, ram_bytes)
}

/// Quantizations to suggest, best balance first.
const PREFERRED: &[&str] = &["Q4_K_M", "Q4_K", "Q4_0", "IQ4_XS", "Q4_K_S", "Q5_K_M", "Q4_K_L", "Q4_K_XL", "Q5_K_S", "Q6_K", "Q8_0"];

/// Describe a repository for the "Add from Hugging Face" screen, or say why
/// none of it can be used.
pub fn describe(model: &ApiModel, link: &HfLink, ram_bytes: Option<u64>) -> Result<HubModel, String> {
    if let Some(problem) = repo_problem(model) {
        return Err(problem);
    }

    if let Some(wanted) = &link.file {
        if is_projector(wanted) {
            return Err("That file is a vision add-on, not a model. Paste the link of the model's page instead.".to_string());
        }
        if !model.siblings.iter().any(|f| &f.rfilename == wanted) {
            return Err("That file isn't in this model's repository. Paste the link of the model's page instead.".to_string());
        }
    }

    let mut files: Vec<HubFile> = model
        .model_files()
        .map(|f| {
            let size = f.size().unwrap_or(0);
            HubFile {
                filename: f.rfilename.clone(),
                size_bytes: size,
                size_label: size_label(size),
                quantization: quant_label(quant_of(&f.rfilename)),
                min_ram_gb: min_ram_gb(size),
                fit: fit(size, ram_bytes).to_string(),
                problem: file_problem(f, ram_bytes),
            }
        })
        .collect();
    files.sort_by_key(|f| f.size_bytes);

    let usable: Vec<&HubFile> = files.iter().filter(|f| f.problem.is_none()).collect();
    if usable.is_empty() {
        if model.model_files().all(|f| is_split_part(&f.rfilename)) {
            return Err("This model only comes split into several files, which Neurix can't download. Look for a smaller version of it.".to_string());
        }
        // When even the smallest single file is too big, say that, with its
        // numbers: it is the most common reason and the most useful answer.
        let smallest = files.iter().find(|f| !is_split_part(&f.filename));
        return Err(smallest
            .and_then(|f| size_problem(f.size_bytes, ram_bytes))
            .unwrap_or_else(|| "None of this model's files can be used by Neurix.".to_string()));
    }

    let selected = link
        .file
        .clone()
        .filter(|wanted| usable.iter().any(|f| &f.filename == wanted))
        .or_else(|| {
            let quant = link.quant.as_deref()?;
            usable.iter().find(|f| quant_of(&f.filename) == Some(quant)).map(|f| f.filename.clone())
        })
        .or_else(|| {
            let fits = |f: &&&HubFile| f.fit != "too_big";
            PREFERRED
                .iter()
                .find_map(|q| usable.iter().filter(fits).find(|f| quant_of(&f.filename) == Some(*q)))
                .or_else(|| usable.iter().filter(fits).last())
                .or_else(|| usable.first())
                .map(|f| f.filename.clone())
        });

    let (author, name) = model.id.split_once('/').unwrap_or(("", &model.id));
    let gguf = model.gguf.as_ref();
    Ok(HubModel {
        repo: model.id.clone(),
        author: author.to_string(),
        name: name.to_string(),
        architecture: gguf.and_then(|g| g.architecture.clone()),
        parameters: gguf.and_then(|g| g.total).filter(|&n| n > 0).map(parameters_label),
        license: model.license(),
        has_chat_template: gguf.and_then(|g| g.chat_template.as_ref()).is_some_and(|t| !t.trim().is_empty()),
        files,
        selected,
    })
}

/// Build the catalog entry for one file of a repository, checking it again
/// from the API data rather than trusting what the screen sent back.
pub fn entry_for(
    model: &ApiModel,
    filename: &str,
    header_arch: Option<&str>,
    ram_bytes: Option<u64>,
) -> Result<ModelInfo, String> {
    if let Some(problem) = repo_problem(model) {
        return Err(problem);
    }
    let file = model
        .model_files()
        .find(|f| f.rfilename == filename)
        .ok_or_else(|| "That file isn't in this model's repository any more.".to_string())?;
    if let Some(problem) = file_problem(file, ram_bytes) {
        return Err(problem);
    }
    if let Some(problem) = header_arch.and_then(architecture_problem) {
        return Err(problem);
    }
    let size = file.size().unwrap_or(0);
    let sha256 = file.sha256();
    let arch = header_arch.or(model.architecture());
    let gguf = model.gguf.as_ref();
    let template = gguf.and_then(|g| g.chat_template.as_deref()).unwrap_or("");
    let quant = quant_of(filename);
    let author = model.id.split_once('/').map(|(a, _)| a).unwrap_or("");
    let base = filename.rsplit('/').next().unwrap_or(filename);
    let display = base.strip_suffix(".gguf").or_else(|| base.strip_suffix(".GGUF")).unwrap_or(base);

    Ok(ModelInfo {
        id: added_id(&model.id, filename),
        name: display.to_string(),
        description: format!(
            "Added by you from Hugging Face ({}). Made by {author}; Neurix did not make or review it.",
            model.id
        ),
        size_bytes: size,
        size_label: size_label(size),
        tag: "Added".to_string(),
        hf_repo: model.id.clone(),
        hf_filename: filename.to_string(),
        sha256,
        company: author.to_string(),
        parameters: gguf
            .and_then(|g| g.total)
            .filter(|&n| n > 0)
            .map(parameters_label)
            .unwrap_or_else(|| "Unknown".to_string()),
        quantization: quant_label(quant),
        best_for: vec!["Added from Hugging Face".to_string()],
        context_length: 8192,
        min_ram_gb: min_ram_gb(size),
        quality: 3,
        speed: 3,
        reasoning: if template.contains("enable_thinking") { Reasoning::Optional } else { Reasoning::None },
        released: String::new(),
        legacy: false,
        sampling: sampling_for(arch),
    })
}

// ── GGUF header ─────────────────────────────────────────────────────────

/// The `general.architecture` value from the start of a GGUF file.
/// `Err` when the bytes are not a GGUF at all; `Ok(None)` when the key was
/// not reached within the bytes given.
pub fn gguf_architecture(buf: &[u8]) -> Result<Option<String>, String> {
    let not_gguf = || "This file isn't a GGUF model, so Neurix can't run it.".to_string();
    if buf.len() < 24 || &buf[..4] != b"GGUF" {
        return Err(not_gguf());
    }
    let version = u32::from_le_bytes(buf[4..8].try_into().unwrap());
    if version < 2 {
        return Err("This file uses an old GGUF version that Neurix can't run.".to_string());
    }
    let kv_count = u64::from_le_bytes(buf[16..24].try_into().unwrap());
    let mut r = Reader { buf, pos: 24 };
    for _ in 0..kv_count.min(10_000) {
        let Some(key) = r.string() else { return Ok(None) };
        let Some(kind) = r.u32() else { return Ok(None) };
        if key == "general.architecture" && kind == 8 {
            return Ok(r.string().map(|s| s.to_string()));
        }
        if r.skip_value(kind).is_none() {
            return Ok(None);
        }
    }
    Ok(None)
}

struct Reader<'a> {
    buf: &'a [u8],
    pos: usize,
}

impl<'a> Reader<'a> {
    fn take(&mut self, n: usize) -> Option<&'a [u8]> {
        let end = self.pos.checked_add(n)?;
        let bytes = self.buf.get(self.pos..end)?;
        self.pos = end;
        Some(bytes)
    }

    fn u32(&mut self) -> Option<u32> {
        Some(u32::from_le_bytes(self.take(4)?.try_into().ok()?))
    }

    fn u64(&mut self) -> Option<u64> {
        Some(u64::from_le_bytes(self.take(8)?.try_into().ok()?))
    }

    fn string(&mut self) -> Option<&'a str> {
        let len = usize::try_from(self.u64()?).ok()?;
        std::str::from_utf8(self.take(len)?).ok()
    }

    fn skip_value(&mut self, kind: u32) -> Option<()> {
        match kind {
            0 | 1 | 7 => self.take(1).map(|_| ()),
            2 | 3 => self.take(2).map(|_| ()),
            4 | 5 | 6 => self.take(4).map(|_| ()),
            10..=12 => self.take(8).map(|_| ()),
            8 => self.string().map(|_| ()),
            9 => {
                let inner = self.u32()?;
                let count = self.u64()?;
                for _ in 0..count {
                    self.skip_value(inner)?;
                }
                Some(())
            }
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn link(text: &str) -> HfLink {
        parse_link(text).unwrap_or_else(|e| panic!("{text}: {e}"))
    }

    #[test]
    fn reads_every_usual_link_form() {
        let page = HfLink { repo: "unsloth/Qwen3.5-2B-GGUF".into(), file: None, quant: None };
        assert_eq!(link("https://huggingface.co/unsloth/Qwen3.5-2B-GGUF"), page);
        assert_eq!(link("huggingface.co/unsloth/Qwen3.5-2B-GGUF/"), page);
        assert_eq!(link("https://www.huggingface.co/unsloth/Qwen3.5-2B-GGUF?library=llama.cpp"), page);
        assert_eq!(link("https://hf.co/unsloth/Qwen3.5-2B-GGUF"), page);
        assert_eq!(link("unsloth/Qwen3.5-2B-GGUF"), page);
        assert_eq!(link("https://huggingface.co/unsloth/Qwen3.5-2B-GGUF/tree/main"), page);

        let file = link("https://huggingface.co/unsloth/Qwen3.5-2B-GGUF/blob/main/Qwen3.5-2B-Q4_K_M.gguf");
        assert_eq!(file.file.as_deref(), Some("Qwen3.5-2B-Q4_K_M.gguf"));
        let download = link("https://huggingface.co/a/b/resolve/main/sub/x-Q8_0.gguf?download=true");
        assert_eq!(download.repo, "a/b");
        assert_eq!(download.file.as_deref(), Some("sub/x-Q8_0.gguf"));

        let tagged = link("bartowski/Llama-3.2-1B-Instruct-GGUF:q4_k_m");
        assert_eq!(tagged.quant.as_deref(), Some("Q4_K_M"));
    }

    #[test]
    fn refuses_other_sites_and_non_models() {
        for bad in [
            "https://example.com/unsloth/Qwen3.5-2B-GGUF",
            "https://huggingface.co.evil.com/a/b",
            "ftp://huggingface.co/a/b",
            "https://huggingface.co/",
            "https://huggingface.co/unsloth",
            "https://huggingface.co/datasets/a/b",
            "https://huggingface.co/spaces/a/b",
            "https://huggingface.co/models?search=qwen",
            "https://huggingface.co/../etc/passwd",
            "https://huggingface.co/a/b/blob/main/model.safetensors",
            "https://huggingface.co/a/b/blob/main/..%2F..%2Fx.gguf",
            "two words",
            "",
        ] {
            assert!(parse_link(bad).is_err(), "{bad} was accepted");
        }
    }

    #[test]
    fn spots_split_files_and_projectors() {
        assert!(is_split_part("Big-Q4_K_M-00001-of-00003.gguf"));
        assert!(is_split_part("Q4_K_M/Big-Q4_K_M-00002-of-00002.gguf"));
        assert!(!is_split_part("Qwen3.5-2B-Q4_K_M.gguf"));
        assert!(is_projector("mmproj-F16.gguf"));
        assert!(is_projector("Model.mmproj-Q8_0.gguf"));
        assert!(!is_projector("Qwen3.5-2B-Q4_K_M.gguf"));
    }

    #[test]
    fn names_the_quantization() {
        assert_eq!(quant_of("Qwen3.5-2B-Q4_K_M.gguf"), Some("Q4_K_M"));
        assert_eq!(quant_of("Huihui-Qwen3.5-4B-abliterated.Q5_K_M.gguf"), Some("Q5_K_M"));
        assert_eq!(quant_of("gemma-4-E2B_q4_0-it.gguf"), Some("Q4_0"));
        assert_eq!(quant_of("model-IQ4_XS.gguf"), Some("IQ4_XS"));
        assert_eq!(quant_of("model-bf16.gguf"), Some("BF16"));
        assert_eq!(quant_of("model.gguf"), None);
        assert_eq!(quant_label(Some("Q4_K_M")), "Q4_K_M (4-bit)");
        assert_eq!(quant_label(Some("IQ4_XS")), "IQ4_XS (4-bit)");
        assert_eq!(quant_label(Some("BF16")), "BF16 (16-bit)");
        assert_eq!(quant_label(None), "Unknown");
    }

    #[test]
    fn memory_needs_match_the_catalog() {
        assert_eq!(min_ram_gb(2_740_937_888), 8);
        assert_eq!(min_ram_gb(1_280_835_840), 5);
        const GIB: u64 = 1 << 30;
        assert_eq!(fit(2_740_937_888, Some(16 * GIB)), "good");
        assert_eq!(fit(2_740_937_888, Some(6 * GIB)), "tight");
        assert_eq!(fit(5_154_941_280, Some(6 * GIB)), "too_big");
        assert_eq!(fit(5_154_941_280, None), "unknown");
    }

    #[test]
    fn a_30b_model_is_refused_on_a_laptop() {
        const GIB: u64 = 1 << 30;
        // A 30B model at 4 bits is about 18 GB.
        assert!(size_problem(18_000_000_000, Some(16 * GIB)).is_some());
        assert!(size_problem(18_000_000_000, Some(32 * GIB)).is_none());
        assert!(size_problem(2_700_000_000, Some(8 * GIB)).is_none());
        assert!(size_problem(60_000_000_000, None).is_some());
        assert!(size_problem(5_000_000_000, None).is_none());
    }

    #[test]
    fn knows_which_architectures_chat() {
        assert_eq!(architecture_support("qwen35"), ArchSupport::Chat);
        assert_eq!(architecture_support("gemma4"), ArchSupport::Chat);
        assert_eq!(architecture_support("LFM2"), ArchSupport::Chat);
        assert_eq!(architecture_support("bert"), ArchSupport::NotChat);
        assert_eq!(architecture_support("clip"), ArchSupport::NotChat);
        assert_eq!(architecture_support("lfm3"), ArchSupport::Unsupported);
    }

    #[test]
    fn ids_are_stable_path_safe_and_distinct() {
        let a = added_id("unsloth/Qwen3.5-2B-GGUF", "Qwen3.5-2B-Q4_K_M.gguf");
        assert_eq!(a, added_id("unsloth/Qwen3.5-2B-GGUF", "Qwen3.5-2B-Q4_K_M.gguf"));
        assert!(a.starts_with("hf-unsloth-qwen3.5-2b-gguf-qwen3.5-2b-q4-k-m-"));
        assert!(a.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '.'));
        assert_ne!(a, added_id("unsloth/Qwen3.5-2B-GGUF", "Qwen3.5-2B-Q5_K_M.gguf"));
        let long = added_id(&format!("o/{}", "x".repeat(96)), "sub/dir/file.gguf");
        assert!(long.len() <= 3 + 60 + 1 + 8);
        assert!(!long.contains('/'));
    }

    fn gguf(kvs: &[(&str, u32, Vec<u8>)]) -> Vec<u8> {
        let mut out = b"GGUF".to_vec();
        out.extend(3u32.to_le_bytes());
        out.extend(0u64.to_le_bytes());
        out.extend((kvs.len() as u64).to_le_bytes());
        for (key, kind, value) in kvs {
            out.extend((key.len() as u64).to_le_bytes());
            out.extend(key.as_bytes());
            out.extend(kind.to_le_bytes());
            out.extend(value);
        }
        out
    }

    fn gguf_str(s: &str) -> Vec<u8> {
        let mut v = (s.len() as u64).to_le_bytes().to_vec();
        v.extend(s.as_bytes());
        v
    }

    #[test]
    fn reads_the_architecture_from_a_header() {
        let mut array = 8u32.to_le_bytes().to_vec();
        array.extend(2u64.to_le_bytes());
        array.extend(gguf_str("a"));
        array.extend(gguf_str("b"));
        let file = gguf(&[
            ("general.alignment", 4, 32u32.to_le_bytes().to_vec()),
            ("general.tags", 9, array),
            ("general.architecture", 8, gguf_str("qwen35")),
        ]);
        assert_eq!(gguf_architecture(&file), Ok(Some("qwen35".to_string())));
        // Cut short before the key: not known, but not an error either.
        assert_eq!(gguf_architecture(&file[..40]), Ok(None));
        assert!(gguf_architecture(b"<!DOCTYPE html><html>....................").is_err());
    }
}
